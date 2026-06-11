import { createHash } from 'node:crypto';
import { ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AuditService } from '../audit/audit.service';
import {
  CRITICAL_ACTION_NOTIFIER,
  CriticalActionStatus,
  CriticalActionType,
  PENDING_CRITICAL_ACTIONS_REPOSITORY,
  type ICriticalActionNotifier,
  type IPendingCriticalActionsRepository,
  type PendingCriticalAction,
} from '~/domain/auth-v2/ports/pending-critical-actions.port';

/** Окно сбора подписей — 24ч (governance: ≤24ч, не env-тюнится). */
export const CRITICAL_ACTION_WINDOW_MS = 24 * 60 * 60 * 1000;
/** Минимум подписей для финализации: инициатор + ≥1 член совета. */
export const REQUIRED_CONFIRMATIONS = 2;

export interface InitiateCriticalActionInput {
  actionType: CriticalActionType;
  actorId: string;
  targetId: string;
  payload?: Record<string, unknown>;
}

/**
 * Multi-party critical actions (Story 6.8). Критическое действие (исключение пайщика,
 * смена ролей совета, force-recovery, смена типов верификации) не выполняется одним
 * человеком: инициатор-председатель ставит его в pending, ≥1 член совета (отличный от
 * инициатора) подтверждает в окне ≤24ч → 2 подписи → финализация. Без второй подписи в
 * окне — истечение. Гейтинг прав (кто инициирует/подтверждает) — на guard'е через
 * `@CheckAbility('create'|'confirm', 'CriticalAction')`; здесь — кворум, окно, различимость
 * подписантов и аудит. Разблокирует Story 4.7.
 */
@Injectable()
export class CriticalActionsService {
  private readonly logger = new Logger(CriticalActionsService.name);

  constructor(
    @Inject(PENDING_CRITICAL_ACTIONS_REPOSITORY)
    private readonly repo: IPendingCriticalActionsRepository,
    @Inject(CRITICAL_ACTION_NOTIFIER)
    private readonly notifier: ICriticalActionNotifier,
    private readonly audit: AuditService,
  ) {}

  /** Инициатор (председатель) создаёт pending-действие с первой подписью и зовёт совет. */
  async initiate(input: InitiateCriticalActionInput): Promise<PendingCriticalAction> {
    const nowMs = Date.now();
    const action = await this.repo.create({
      actionType: input.actionType,
      actorId: input.actorId,
      targetId: input.targetId,
      payload: input.payload ?? {},
      expiresAt: new Date(nowMs + CRITICAL_ACTION_WINDOW_MS).toISOString(),
      confirmations: [{ by: input.actorId, at: new Date(nowMs).toISOString() }],
    });
    await this.notifier.notifyPending(action);
    this.logger.log(`critical-action инициировано: ${action.actionType} ${action.id} actor=${action.actorId}`);
    return action;
  }

  /**
   * Член совета (≠ инициатор) подтверждает. Достижение 2 подписей в окне → финализация
   * с аудитом обоих подписантов. Бросает на: не найдено / не pending / истекло / само-
   * подтверждение / повторная подпись.
   */
  async confirm(actionId: string, confirmerId: string): Promise<PendingCriticalAction> {
    const action = await this.repo.findById(actionId);
    if (!action) throw new NotFoundException('Критическое действие не найдено');
    if (action.status !== CriticalActionStatus.Pending)
      throw new ConflictException('Действие уже не в статусе ожидания');

    if (Date.now() > new Date(action.expiresAt).getTime()) {
      await this.expire(action); // ленивое истечение на пути подтверждения
      throw new ConflictException('Окно подтверждения истекло');
    }
    if (confirmerId === action.actorId)
      throw new ConflictException('Инициатор не может подтверждать собственное действие');
    if (action.confirmations.some((c) => c.by === confirmerId))
      throw new ConflictException('Этот член совета уже подтвердил действие');

    action.confirmations.push({ by: confirmerId, at: new Date().toISOString() });

    if (action.confirmations.length >= REQUIRED_CONFIRMATIONS) {
      action.status = CriticalActionStatus.Confirmed;
      action.finalizedAt = new Date().toISOString();
      await this.repo.update(action);
      await this.auditConfirmed(action);
      this.logger.log(`critical-action финализировано: ${action.id} подписантов=${action.confirmations.length}`);
    } else {
      await this.repo.update(action);
    }
    return action;
  }

  /** Cron: ежедневно отменяет pending-действия с истёкшим окном. */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async expireStale(): Promise<void> {
    const stale = await this.repo.listExpired(new Date().toISOString());
    for (const action of stale) await this.expire(action);
    if (stale.length) this.logger.log(`critical-action истекло по таймеру: ${stale.length}`);
  }

  private async expire(action: PendingCriticalAction): Promise<void> {
    action.status = CriticalActionStatus.Expired;
    action.finalizedAt = new Date().toISOString();
    await this.repo.update(action);
    await this.audit.record({
      event: 'CriticalActionExpired',
      subjectId: action.targetId,
      actor: action.actorId,
      result: 'failure',
      context: {
        action_type: action.actionType,
        initiator_id: action.actorId,
        confirmations_count: action.confirmations.length,
      },
    });
  }

  /** Аудит финализированного действия с обоими подписантами + хэш payload (Story 6.10). */
  private async auditConfirmed(action: PendingCriticalAction): Promise<void> {
    await this.audit.record({
      event: 'CriticalActionConfirmed',
      subjectId: action.targetId,
      actor: action.confirmations[action.confirmations.length - 1]?.by ?? action.actorId,
      result: 'success',
      context: {
        action_type: action.actionType,
        target_id: action.targetId,
        initiator_id: action.actorId,
        confirmer_ids: action.confirmations,
        payload_hash: this.payloadHash(action.payload),
      },
    });
  }

  private payloadHash(payload: Record<string, unknown>): string {
    return createHash('sha256').update(JSON.stringify(payload ?? {})).digest('hex');
  }
}
