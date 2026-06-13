import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AccessRulePrincipalKind, ACCESS_RULES_INVALIDATION_PUBLISHER, type IAccessRulesInvalidationPublisher } from '~/domain/auth-v2/ports/access-rules.port';
import {
  CAPABILITY_SETS_REPOSITORY,
  type CapabilitySet,
  type CapabilitySetAssignment,
  type ICapabilitySetsRepository,
} from '~/domain/auth-v2/ports/capability-sets.port';
import { AuditService } from '../audit/audit.service';

export interface AssignSetInput {
  username: string;
  setKey: string;
  grantedBy: string;
  expiresAt?: string | null;
}

/**
 * Назначаемые наборы возможностей (Story 6.11) — бэкенд расширяемых ролей. Председатель
 * назначает/отзывает пайщику именованный набор («бухгалтер»/«кассир»); правила набора
 * лежат в `access_rules` (subject_type='capability_set'), движок CASL переиспользуется
 * (см. AbilityFactory). Гейтинг права (`manage CapabilitySet`) — на guard'е контроллера;
 * здесь — валидация набора, аудит и инвалидация активных сессий пайщика.
 *
 * Назначаемые роли (этот сервис) ≠ вычисляемые роли (оператор ПВЗ и т.п., выводятся из
 * контекста на своих столах).
 */
@Injectable()
export class CapabilitySetService {
  private readonly logger = new Logger(CapabilitySetService.name);

  constructor(
    @Inject(CAPABILITY_SETS_REPOSITORY)
    private readonly repo: ICapabilitySetsRepository,
    @Inject(ACCESS_RULES_INVALIDATION_PUBLISHER)
    private readonly invalidation: IAccessRulesInvalidationPublisher,
    private readonly audit: AuditService,
  ) {}

  /** Каталог наборов для admin-UI выдачи (страница «Персонал» стола совета). */
  listSets(): Promise<CapabilitySet[]> {
    return this.repo.listSets();
  }

  /** Активные назначения пайщика (что он имеет сейчас). */
  listForParticipant(username: string): Promise<CapabilitySetAssignment[]> {
    if (!username) throw new BadRequestException('username обязателен');
    return this.repo.listAssignments(username);
  }

  /** Председатель назначает набор пайщику. Валидирует существование набора. */
  async assign(input: AssignSetInput): Promise<void> {
    if (!input.username) throw new BadRequestException('username обязателен');
    const set = await this.repo.findSet(input.setKey);
    if (!set) throw new NotFoundException(`Набор возможностей «${input.setKey}» не найден`);

    await this.repo.assign({
      username: input.username,
      setKey: input.setKey,
      grantedBy: input.grantedBy,
      expiresAt: input.expiresAt ?? null,
    });
    await this.invalidate(input.username);
    await this.audit.record({
      event: 'CapabilitySetAssigned',
      subjectId: input.username,
      actor: input.grantedBy,
      result: 'success',
      context: { set_key: input.setKey, expires_at: input.expiresAt ?? null },
    });
    this.logger.log(`capability-set назначен: ${input.setKey} → ${input.username} (by ${input.grantedBy})`);
  }

  /** Председатель отзывает набор у пайщика. */
  async revoke(username: string, setKey: string, revokedBy: string): Promise<void> {
    if (!username) throw new BadRequestException('username обязателен');
    const existed = await this.repo.revoke(username, setKey);
    if (!existed) throw new NotFoundException(`У пайщика «${username}» нет активного набора «${setKey}»`);

    await this.invalidate(username);
    await this.audit.record({
      event: 'CapabilitySetRevoked',
      subjectId: username,
      actor: revokedBy,
      result: 'success',
      context: { set_key: setKey },
    });
    this.logger.log(`capability-set отозван: ${setKey} у ${username} (by ${revokedBy})`);
  }

  /** Сброс закэшированной Ability активных сессий пайщика (права сменились). */
  private async invalidate(username: string): Promise<void> {
    await this.invalidation.publish({
      subjectType: AccessRulePrincipalKind.Participant,
      subjectId: username,
    });
  }
}
