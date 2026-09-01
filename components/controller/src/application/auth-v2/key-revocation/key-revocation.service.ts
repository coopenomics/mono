import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  KEY_REVOCATION_REPOSITORY,
  type IKeyRevocationRepository,
} from '~/domain/auth-v2/ports/key-revocation.port';
import { AuditService } from '../audit/audit.service';
import { SessionsService } from '../sessions/sessions.service';

export interface RevokeKeyInput {
  targetId: string;
  reason: string;
  chairmanId: string;
  ip?: string | null;
}

export interface RevokeKeyResult {
  status: 'revoked';
  targetId: string;
  /** Сколько активных сессий пайщика отозвано. */
  sessionsRevoked: number;
  /** Пайщик обязан пройти recovery для получения нового ключа. */
  mustRecover: true;
}

/**
 * Manual revoke (CoopID, Story 4.7). Председатель по сообщению пайщика о компрометации
 * отзывает его ключ: (1) durable pending-state в `revoked_keys` — MVP-вариант AC «или с
 * переходом на pending state» вместо on-chain `updateauth` (реальная ротация ключа —
 * recovery-flow Эпика 3, finalization placeholder 3.3); (2) отзыв всех активных сессий
 * пайщика; (3) audit `KeyRevokedManually` с reason и chairman_id. После отзыва пайщик
 * принудительно проходит recovery. Полный compromised-key registry с авто-проверкой при
 * verify — Growth (PRD FR65). Право вызова гейтит контроллер (`@CheckAbility`).
 */
@Injectable()
export class KeyRevocationService {
  private readonly logger = new Logger(KeyRevocationService.name);

  constructor(
    @Inject(KEY_REVOCATION_REPOSITORY) private readonly repo: IKeyRevocationRepository,
    private readonly sessions: SessionsService,
    private readonly audit: AuditService,
  ) {}

  async revoke(input: RevokeKeyInput): Promise<RevokeKeyResult> {
    const { targetId, reason, chairmanId } = input;
    const ip = input.ip ?? null;

    // 1. Durable pending-state: ключ отозван, пайщик обязан пройти recovery.
    await this.repo.record({ targetId, reason, revokedBy: chairmanId });

    // 2. Отозвать все активные сессии пайщика (доступ по старому ключу прекращается).
    const { revoked } = await this.sessions.revokeAll(targetId, ip);

    // 3. Аудит ручного отзыва с обоснованием и инициатором.
    await this.audit.record({
      event: 'KeyRevokedManually',
      subjectId: targetId,
      actor: chairmanId,
      result: 'success',
      ip,
      context: { target_id: targetId, reason, chairman_id: chairmanId, sessions_revoked: revoked },
    });

    this.logger.warn(`ключ пайщика отозван вручную: target=${targetId} by=${chairmanId} sessions=${revoked}`);
    return { status: 'revoked', targetId, sessionsRevoked: revoked, mustRecover: true };
  }

  /** Активен ли отзыв ключа пайщика (пайщик ещё не прошёл recovery). */
  async isPendingRecovery(targetId: string): Promise<boolean> {
    return (await this.repo.findActive(targetId)) !== null;
  }
}
