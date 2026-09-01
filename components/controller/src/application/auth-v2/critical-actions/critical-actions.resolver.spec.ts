import type { CriticalActionsService } from './critical-actions.service';
import type { KeyRevocationService } from '../key-revocation/key-revocation.service';
import type { ForceRecoveryService } from '../force-recovery/force-recovery.service';
import { CriticalActionStatus, CriticalActionType } from '~/domain/auth-v2/ports/pending-critical-actions.port';
import { ForceRecoveryConsentVia } from '../force-recovery/force-recovery.service';
import { CriticalActionsResolver } from './critical-actions.resolver';

const CHAIRMAN = { id: 'u1', username: 'chairman1', role: 'chairman' };
const IP = '203.0.113.7';

const PENDING = {
  id: 'ca1',
  actionType: CriticalActionType.ExcludeParticipant,
  actorId: 'chairman1',
  targetId: 'payer1',
  payload: { reason: 'x' },
  status: CriticalActionStatus.Pending,
  confirmations: [{ by: 'chairman1', at: '2026-06-14T00:00:00Z' }],
  createdAt: '2026-06-14T00:00:00Z',
  expiresAt: '2026-06-15T00:00:00Z',
  finalizedAt: null,
};

function build() {
  const criticalActions = {
    initiate: jest.fn(async () => PENDING),
    confirm: jest.fn(async () => ({ ...PENDING, status: CriticalActionStatus.Confirmed })),
    getAuditTrail: jest.fn(async () => [
      {
        id: 'ca1',
        actionType: CriticalActionType.ExcludeParticipant,
        targetId: 'payer1',
        status: CriticalActionStatus.Confirmed,
        createdAt: '2026-06-14T00:00:00Z',
        finalizedAt: '2026-06-14T01:00:00Z',
        initiatorId: 'chairman1',
        initiatedAt: '2026-06-14T00:00:00Z',
        confirmerIds: [{ by: 'member1', at: '2026-06-14T00:30:00Z' }],
        payloadHash: 'deadbeef',
      },
    ]),
  };
  const keyRevocation = {
    revoke: jest.fn(async () => ({ status: 'revoked', targetId: 'payer1', sessionsRevoked: 2, mustRecover: true })),
  };
  const forceRecovery = {
    requestConsent: jest.fn(async () => undefined),
    authorize: jest.fn(async () => ({
      authorized: true,
      consentVia: ForceRecoveryConsentVia.AssemblyDecision,
      triggeredBy: 'chairman',
    })),
  };
  const resolver = new CriticalActionsResolver(
    criticalActions as unknown as CriticalActionsService,
    keyRevocation as unknown as KeyRevocationService,
    forceRecovery as unknown as ForceRecoveryService,
  );
  return { resolver, criticalActions, keyRevocation, forceRecovery };
}

describe('CriticalActionsResolver', () => {
  it('initiateCriticalAction ставит actorId = текущий пользователь и маппит pending в snake_case', async () => {
    const { resolver, criticalActions } = build();
    const out = await resolver.initiateCriticalAction(
      { action_type: CriticalActionType.ExcludeParticipant, target_id: 'payer1', payload: { reason: 'x' } },
      CHAIRMAN,
    );
    expect(criticalActions.initiate).toHaveBeenCalledWith({
      actionType: CriticalActionType.ExcludeParticipant,
      actorId: 'chairman1',
      targetId: 'payer1',
      payload: { reason: 'x' },
    });
    expect(out).toEqual({
      id: 'ca1',
      action_type: CriticalActionType.ExcludeParticipant,
      actor_id: 'chairman1',
      target_id: 'payer1',
      payload: { reason: 'x' },
      status: CriticalActionStatus.Pending,
      confirmations: [{ by: 'chairman1', at: '2026-06-14T00:00:00Z' }],
      created_at: '2026-06-14T00:00:00Z',
      expires_at: '2026-06-15T00:00:00Z',
      finalized_at: null,
    });
  });

  it('initiateCriticalAction без payload передаёт undefined', async () => {
    const { resolver, criticalActions } = build();
    await resolver.initiateCriticalAction(
      { action_type: CriticalActionType.ForceRecovery, target_id: 'payer1' },
      CHAIRMAN,
    );
    expect(criticalActions.initiate).toHaveBeenCalledWith({
      actionType: CriticalActionType.ForceRecovery,
      actorId: 'chairman1',
      targetId: 'payer1',
      payload: undefined,
    });
  });

  it('confirmCriticalAction подтверждает от имени текущего пользователя', async () => {
    const { resolver, criticalActions } = build();
    const out = await resolver.confirmCriticalAction('ca1', CHAIRMAN);
    expect(criticalActions.confirm).toHaveBeenCalledWith('ca1', 'chairman1');
    expect(out.status).toBe(CriticalActionStatus.Confirmed);
  });

  it('getCriticalActionAuditTrail маппит атрибуцию в snake_case', async () => {
    const { resolver, criticalActions } = build();
    const out = await resolver.getCriticalActionAuditTrail('payer1');
    expect(criticalActions.getAuditTrail).toHaveBeenCalledWith('payer1');
    expect(out).toEqual([
      {
        id: 'ca1',
        action_type: CriticalActionType.ExcludeParticipant,
        target_id: 'payer1',
        status: CriticalActionStatus.Confirmed,
        created_at: '2026-06-14T00:00:00Z',
        finalized_at: '2026-06-14T01:00:00Z',
        initiator_id: 'chairman1',
        initiated_at: '2026-06-14T00:00:00Z',
        confirmer_ids: [{ by: 'member1', at: '2026-06-14T00:30:00Z' }],
        payload_hash: 'deadbeef',
      },
    ]);
  });

  it('revokeParticipantKey ставит chairmanId = текущий пользователь и маппит результат', async () => {
    const { resolver, keyRevocation } = build();
    const out = await resolver.revokeParticipantKey({ target_id: 'payer1', reason: 'compromise' }, CHAIRMAN, IP);
    expect(keyRevocation.revoke).toHaveBeenCalledWith({
      targetId: 'payer1',
      reason: 'compromise',
      chairmanId: 'chairman1',
      ip: IP,
    });
    expect(out).toEqual({ status: 'revoked', target_id: 'payer1', sessions_revoked: 2, must_recover: true });
  });

  it('requestForceRecoveryConsent зовёт сервис с инициатором и возвращает true', async () => {
    const { resolver, forceRecovery } = build();
    const ok = await resolver.requestForceRecoveryConsent({ target_id: 'payer1' }, CHAIRMAN, IP);
    expect(ok).toBe(true);
    expect(forceRecovery.requestConsent).toHaveBeenCalledWith('payer1', 'chairman1', IP);
  });

  it('authorizeForceRecovery маппит результат и прокидывает основания', async () => {
    const { resolver, forceRecovery } = build();
    const out = await resolver.authorizeForceRecovery(
      { target_id: 'payer1', assembly_decision_tx_id: 'tx9', critical_action_id: 'ca1' },
      CHAIRMAN,
      IP,
    );
    expect(forceRecovery.authorize).toHaveBeenCalledWith({
      targetId: 'payer1',
      initiatorId: 'chairman1',
      assemblyDecisionTxId: 'tx9',
      criticalActionId: 'ca1',
      ip: IP,
    });
    expect(out).toEqual({
      authorized: true,
      consent_via: ForceRecoveryConsentVia.AssemblyDecision,
      triggered_by: 'chairman',
    });
  });

  it('authorizeForceRecovery без необязательных полей передаёт undefined', async () => {
    const { resolver, forceRecovery } = build();
    await resolver.authorizeForceRecovery({ target_id: 'payer1' }, CHAIRMAN, IP);
    expect(forceRecovery.authorize).toHaveBeenCalledWith({
      targetId: 'payer1',
      initiatorId: 'chairman1',
      assemblyDecisionTxId: undefined,
      criticalActionId: undefined,
      ip: IP,
    });
  });
});
