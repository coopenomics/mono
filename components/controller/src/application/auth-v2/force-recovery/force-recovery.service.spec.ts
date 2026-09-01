import { ForbiddenException } from '@nestjs/common';
import type {
  IForceRecoveryConsentNotifier,
  IForceRecoveryConsentStore,
} from '~/domain/auth-v2/ports/force-recovery-consent.port';
import type { IRecoveryStrategyRepository } from '~/domain/auth-v2/ports/recovery-strategy.port';
import { RecoveryStrategy } from '~/domain/auth-v2/recovery-strategy/recovery-strategy.types';
import {
  CriticalActionStatus,
  CriticalActionType,
  type IPendingCriticalActionsRepository,
  type PendingCriticalAction,
} from '~/domain/auth-v2/ports/pending-critical-actions.port';
import { ForceRecoveryConsentVia, ForceRecoveryService } from './force-recovery.service';
import type { AuditService } from '../audit/audit.service';

const VALID_TX = 'a'.repeat(64);

function confirmedAction(over: Partial<PendingCriticalAction> = {}): PendingCriticalAction {
  return {
    id: 'ca1',
    actionType: CriticalActionType.ForceRecovery,
    actorId: 'chief',
    targetId: 'victim',
    payload: {},
    status: CriticalActionStatus.Confirmed,
    confirmations: [{ by: 'chief', at: 't0' }, { by: 'councilor', at: 't1' }],
    createdAt: 't',
    expiresAt: 't',
    finalizedAt: 't',
    ...over,
  };
}

function make(opts: {
  granted?: boolean;
  strategy?: RecoveryStrategy | null;
  action?: PendingCriticalAction | null;
} = {}) {
  const consent: IForceRecoveryConsentStore = {
    issueRequest: jest.fn(async () => undefined),
    consumeRequest: jest.fn(async () => ({ targetId: 'victim', initiatorId: 'chief' })),
    markGranted: jest.fn(async () => undefined),
    isGranted: jest.fn(async () => opts.granted ?? false),
  };
  const notifier: IForceRecoveryConsentNotifier = { notifyConsentRequested: jest.fn(async () => undefined) };
  const strategyRepo: IRecoveryStrategyRepository = {
    get: jest.fn(async () => opts.strategy ?? null),
    set: jest.fn(async () => undefined),
  };
  const criticalRepo = {
    findById: jest.fn(async () => opts.action ?? null),
  } as unknown as IPendingCriticalActionsRepository;
  const record = jest.fn(async () => undefined);
  const audit = { record } as unknown as AuditService;
  const service = new ForceRecoveryService(consent, notifier, strategyRepo, criticalRepo, audit);
  return { service, consent, notifier, record };
}

const auditEvents = (record: jest.Mock) => record.mock.calls.map((c) => c[0].event);

describe('ForceRecoveryService — gating (Story 6.9)', () => {
  it('отказ без согласия и без решения собрания → 403 + audit ForceRecoveryDenied', async () => {
    const { service, record } = make({ granted: false });
    await expect(service.authorize({ targetId: 'victim', initiatorId: 'chief' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(auditEvents(record)).toContain('ForceRecoveryDenied');
  });

  it('разрешает по согласию пайщика (magic-link) + audit ForceRecoveryAuthorized triggered_by chairman', async () => {
    const { service, record } = make({ granted: true });
    const res = await service.authorize({ targetId: 'victim', initiatorId: 'chief' });
    expect(res).toEqual({ authorized: true, consentVia: ForceRecoveryConsentVia.ParticipantMagicLink, triggeredBy: 'chairman' });
    expect(auditEvents(record)).toContain('ForceRecoveryAuthorized');
  });

  it('разрешает по решению собрания (валидный tx_id COOPOS)', async () => {
    const { service } = make({ granted: false });
    const res = await service.authorize({ targetId: 'victim', initiatorId: 'chief', assemblyDecisionTxId: VALID_TX });
    expect(res.consentVia).toBe(ForceRecoveryConsentVia.AssemblyDecision);
  });

  it('невалидный tx_id и нет согласия → отказ', async () => {
    const { service } = make({ granted: false });
    await expect(service.authorize({ targetId: 'victim', initiatorId: 'chief', assemblyDecisionTxId: 'not-a-tx' }))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('стратегия Council без подтверждённого critical action → отказ (council_approval_missing)', async () => {
    const { service } = make({ granted: true, strategy: RecoveryStrategy.Council });
    await expect(service.authorize({ targetId: 'victim', initiatorId: 'chief' })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('стратегия Council + подтверждённый force_recovery critical action → разрешено', async () => {
    const { service } = make({ granted: true, strategy: RecoveryStrategy.Council, action: confirmedAction() });
    const res = await service.authorize({ targetId: 'victim', initiatorId: 'chief', criticalActionId: 'ca1' });
    expect(res.authorized).toBe(true);
  });

  it('Council: critical action не confirmed / чужой target / не тот тип → отказ', async () => {
    const notConfirmed = make({ granted: true, strategy: RecoveryStrategy.Council, action: confirmedAction({ status: CriticalActionStatus.Pending }) });
    await expect(notConfirmed.service.authorize({ targetId: 'victim', initiatorId: 'chief', criticalActionId: 'ca1' })).rejects.toBeInstanceOf(ForbiddenException);

    const wrongTarget = make({ granted: true, strategy: RecoveryStrategy.Council, action: confirmedAction({ targetId: 'someone-else' }) });
    await expect(wrongTarget.service.authorize({ targetId: 'victim', initiatorId: 'chief', criticalActionId: 'ca1' })).rejects.toBeInstanceOf(ForbiddenException);

    const wrongType = make({ granted: true, strategy: RecoveryStrategy.Council, action: confirmedAction({ actionType: CriticalActionType.ExcludeParticipant }) });
    await expect(wrongType.service.authorize({ targetId: 'victim', initiatorId: 'chief', criticalActionId: 'ca1' })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('requestConsent выдаёт токен, шлёт пайщику и аудитит', async () => {
    const { service, consent, notifier, record } = make();
    await service.requestConsent('victim', 'chief', null);
    expect(consent.issueRequest).toHaveBeenCalled();
    expect(notifier.notifyConsentRequested).toHaveBeenCalledWith(expect.objectContaining({ targetId: 'victim', initiatorId: 'chief', token: expect.any(String) }));
    expect(auditEvents(record)).toContain('ForceRecoveryConsentRequested');
  });

  it('grantConsent по валидному токену помечает согласие + audit; по неверному → 403', async () => {
    const ok = make();
    const res = await ok.service.grantConsent('tok', null);
    expect(res).toEqual({ targetId: 'victim' });
    expect(ok.consent.markGranted).toHaveBeenCalledWith('victim', 'chief', expect.any(Number));
    expect(auditEvents(ok.record)).toContain('ForceRecoveryConsentGranted');

    const bad = make();
    (bad.consent.consumeRequest as jest.Mock).mockResolvedValueOnce(null);
    await expect(bad.service.grantConsent('bad', null)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
