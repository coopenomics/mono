import { randomUUID } from 'node:crypto';
import { ForbiddenException, Inject, Injectable, Logger } from '@nestjs/common';
import {
  FORCE_RECOVERY_CONSENT_NOTIFIER,
  FORCE_RECOVERY_CONSENT_STORE,
  type IForceRecoveryConsentNotifier,
  type IForceRecoveryConsentStore,
} from '~/domain/auth-v2/ports/force-recovery-consent.port';
import {
  RECOVERY_STRATEGY_REPOSITORY,
  type IRecoveryStrategyRepository,
} from '~/domain/auth-v2/ports/recovery-strategy.port';
import { DEFAULT_RECOVERY_STRATEGY, RecoveryStrategy } from '~/domain/auth-v2/recovery-strategy/recovery-strategy.types';
import {
  CriticalActionStatus,
  CriticalActionType,
  PENDING_CRITICAL_ACTIONS_REPOSITORY,
  type IPendingCriticalActionsRepository,
} from '~/domain/auth-v2/ports/pending-critical-actions.port';
import { AuditService } from '../audit/audit.service';

/** TTL consent-токена (magic-link пайщику) и отметки согласия. */
export const FORCE_RECOVERY_CONSENT_TTL_SEC = 24 * 60 * 60;
export const FORCE_RECOVERY_GRANTED_TTL_SEC = 60 * 60;

/** Чем подтверждено согласие на force-recovery. */
export enum ForceRecoveryConsentVia {
  ParticipantMagicLink = 'participant_magic_link',
  AssemblyDecision = 'assembly_decision',
}

/** Внутренняя причина отказа (для лога/аудита; наружу — единый force_recovery_denied). */
enum ForceRecoveryDenialReason {
  NoConsent = 'no_consent',
  CouncilApprovalMissing = 'council_approval_missing',
}

export interface ForceRecoveryAuthorizeInput {
  targetId: string;
  initiatorId: string;
  /** (б) ссылка на blockchain-anchored решение собрания — tx_id в COOPOS. */
  assemblyDecisionTxId?: string;
  /** При стратегии «решение совета» — id подтверждённого critical action (Story 6.8). */
  criticalActionId?: string;
  ip?: string | null;
}

export interface ForceRecoveryAuthorization {
  authorized: true;
  consentVia: ForceRecoveryConsentVia;
  triggeredBy: 'chairman';
}

/** EOSIO/COOPOS transaction_id — 64 hex-символа. */
const TX_ID_RE = /^[0-9a-f]{64}$/i;

/**
 * Force-recovery rules (Story 6.9). Председатель не может сбросить доступ пайщика
 * единолично: требуется (а) согласие самого пайщика по magic-link ИЛИ (б) решение
 * общего собрания (on-chain tx). Дополнительно — multi-party approval (Story 6.8),
 * если стратегия восстановления пайщика = «решение совета». Любой отказ — `403
 * ForceRecoveryDenied` + audit; разрешение — audit с `triggered_by: chairman`, после
 * чего смена ключа идёт штатным recovery-flow Эпика 3 (финализация — placeholder 3.3).
 */
@Injectable()
export class ForceRecoveryService {
  private readonly logger = new Logger(ForceRecoveryService.name);

  constructor(
    @Inject(FORCE_RECOVERY_CONSENT_STORE) private readonly consent: IForceRecoveryConsentStore,
    @Inject(FORCE_RECOVERY_CONSENT_NOTIFIER) private readonly notifier: IForceRecoveryConsentNotifier,
    @Inject(RECOVERY_STRATEGY_REPOSITORY) private readonly strategyRepo: IRecoveryStrategyRepository,
    @Inject(PENDING_CRITICAL_ACTIONS_REPOSITORY) private readonly criticalRepo: IPendingCriticalActionsRepository,
    private readonly audit: AuditService,
  ) {}

  /** Председатель запрашивает согласие пайщика — пайщику уходит magic-link (канал «а»). */
  async requestConsent(targetId: string, initiatorId: string, ip: string | null): Promise<void> {
    const token = randomUUID();
    await this.consent.issueRequest(token, { targetId, initiatorId }, FORCE_RECOVERY_CONSENT_TTL_SEC);
    await this.notifier.notifyConsentRequested({ targetId, initiatorId, token });
    await this.audit.record({
      event: 'ForceRecoveryConsentRequested',
      subjectId: targetId,
      actor: initiatorId,
      result: 'success',
      ip,
      context: { target_id: targetId, initiator_id: initiatorId },
    });
  }

  /** Пайщик подтверждает согласие кликом по magic-link. Без auth-guard (доступ мог быть утрачен). */
  async grantConsent(token: string, ip: string | null): Promise<{ targetId: string }> {
    const request = await this.consent.consumeRequest(token);
    if (!request) throw new ForbiddenException({ error: 'invalid_consent_token', error_description: 'Ссылка согласия недействительна или истекла' });
    await this.consent.markGranted(request.targetId, request.initiatorId, FORCE_RECOVERY_GRANTED_TTL_SEC);
    await this.audit.record({
      event: 'ForceRecoveryConsentGranted',
      subjectId: request.targetId,
      actor: 'self',
      result: 'success',
      ip,
      context: { target_id: request.targetId, initiator_id: request.initiatorId },
    });
    return { targetId: request.targetId };
  }

  /** Гейт: разрешить force-recovery только при наличии согласия (а)|(б) и совет-approval при Council. */
  async authorize(input: ForceRecoveryAuthorizeInput): Promise<ForceRecoveryAuthorization> {
    const { targetId, initiatorId } = input;

    let consentVia: ForceRecoveryConsentVia | null = null;
    if (await this.consent.isGranted(targetId, initiatorId)) consentVia = ForceRecoveryConsentVia.ParticipantMagicLink;
    else if (input.assemblyDecisionTxId && TX_ID_RE.test(input.assemblyDecisionTxId)) consentVia = ForceRecoveryConsentVia.AssemblyDecision;

    if (!consentVia) throw await this.deny(ForceRecoveryDenialReason.NoConsent, input);

    // Стратегия «решение совета» → дополнительно подтверждённый critical action (6.8).
    const strategy = (await this.strategyRepo.get(targetId)) ?? DEFAULT_RECOVERY_STRATEGY;
    if (strategy === RecoveryStrategy.Council) {
      const ok = await this.councilApprovalConfirmed(input.criticalActionId, targetId);
      if (!ok) throw await this.deny(ForceRecoveryDenialReason.CouncilApprovalMissing, input);
    }

    await this.audit.record({
      event: 'ForceRecoveryAuthorized',
      subjectId: targetId,
      actor: initiatorId,
      result: 'success',
      context: {
        target_id: targetId,
        initiator_id: initiatorId,
        triggered_by: 'chairman',
        consent_via: consentVia,
        assembly_decision_tx: input.assemblyDecisionTxId ?? null,
        critical_action_id: input.criticalActionId ?? null,
      },
    });
    this.logger.log(`force-recovery авторизован: target=${targetId} via=${consentVia}`);
    return { authorized: true, consentVia, triggeredBy: 'chairman' };
  }

  private async councilApprovalConfirmed(criticalActionId: string | undefined, targetId: string): Promise<boolean> {
    if (!criticalActionId) return false;
    const action = await this.criticalRepo.findById(criticalActionId);
    return (
      !!action &&
      action.status === CriticalActionStatus.Confirmed &&
      action.actionType === CriticalActionType.ForceRecovery &&
      action.targetId === targetId
    );
  }

  private async deny(reason: ForceRecoveryDenialReason, input: ForceRecoveryAuthorizeInput): Promise<ForbiddenException> {
    await this.audit.record({
      event: 'ForceRecoveryDenied',
      subjectId: input.targetId,
      actor: input.initiatorId,
      result: 'failure',
      context: { target_id: input.targetId, initiator_id: input.initiatorId, reason },
    });
    this.logger.warn(`force-recovery отказан [${reason}]: target=${input.targetId} initiator=${input.initiatorId}`);
    return new ForbiddenException({
      error: 'force_recovery_denied',
      error_description: 'Force-recovery невозможен без согласия пайщика или решения общего собрания',
    });
  }
}
