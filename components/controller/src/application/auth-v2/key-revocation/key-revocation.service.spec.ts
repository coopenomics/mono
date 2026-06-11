import type { IKeyRevocationRepository, KeyRevocation, NewKeyRevocation } from '~/domain/auth-v2/ports/key-revocation.port';
import { KeyRevocationService } from './key-revocation.service';
import type { SessionsService } from '../sessions/sessions.service';
import type { AuditService } from '../audit/audit.service';

function revocation(over: Partial<KeyRevocation> = {}): KeyRevocation {
  return {
    id: 'r1',
    targetId: 'victim',
    reason: 'compromised',
    revokedBy: 'chief',
    revokedAt: '2026-06-11T00:00:00.000Z',
    recoveredAt: null,
    ...over,
  };
}

function make(opts: { active?: KeyRevocation | null; revokedSessions?: number } = {}) {
  const record = jest.fn(async (i: NewKeyRevocation): Promise<KeyRevocation> => revocation({ targetId: i.targetId, reason: i.reason, revokedBy: i.revokedBy }));
  const repo: IKeyRevocationRepository = {
    record,
    findActive: jest.fn(async () => opts.active ?? null),
    markRecovered: jest.fn(async () => undefined),
  };
  const revokeAll = jest.fn(async () => ({ revoked: opts.revokedSessions ?? 3 }));
  const sessions = { revokeAll } as unknown as SessionsService;
  const auditRecord = jest.fn(async () => undefined);
  const audit = { record: auditRecord } as unknown as AuditService;
  const service = new KeyRevocationService(repo, sessions, audit);
  return { service, repo, record, revokeAll, auditRecord };
}

describe('KeyRevocationService — manual revoke (Story 4.7)', () => {
  it('отзыв фиксирует pending-state, гасит все сессии и аудитит с reason + chairman_id', async () => {
    const { service, record, revokeAll, auditRecord } = make({ revokedSessions: 2 });
    const res = await service.revoke({ targetId: 'victim', reason: 'compromised', chairmanId: 'chief', ip: '1.2.3.4' });

    expect(res).toEqual({ status: 'revoked', targetId: 'victim', sessionsRevoked: 2, mustRecover: true });
    expect(record).toHaveBeenCalledWith({ targetId: 'victim', reason: 'compromised', revokedBy: 'chief' });
    expect(revokeAll).toHaveBeenCalledWith('victim', '1.2.3.4');
    expect(auditRecord).toHaveBeenCalledWith(expect.objectContaining({
      event: 'KeyRevokedManually',
      subjectId: 'victim',
      actor: 'chief',
      result: 'success',
      ip: '1.2.3.4',
      context: expect.objectContaining({ target_id: 'victim', reason: 'compromised', chairman_id: 'chief', sessions_revoked: 2 }),
    }));
  });

  it('записывает отзыв до отзыва сессий (порядок: pending-state → сессии → аудит)', async () => {
    const order: string[] = [];
    const { service, repo, revokeAll, auditRecord } = make();
    (repo.record as jest.Mock).mockImplementation(async (i: NewKeyRevocation) => { order.push('record'); return revocation({ targetId: i.targetId }); });
    revokeAll.mockImplementation(async () => { order.push('revokeAll'); return { revoked: 1 }; });
    auditRecord.mockImplementation(async () => { order.push('audit'); });

    await service.revoke({ targetId: 'victim', reason: 'x', chairmanId: 'chief' });
    expect(order).toEqual(['record', 'revokeAll', 'audit']);
  });

  it('isPendingRecovery=true при активном отзыве, false без него', async () => {
    const withActive = make({ active: revocation() });
    expect(await withActive.service.isPendingRecovery('victim')).toBe(true);

    const without = make({ active: null });
    expect(await without.service.isPendingRecovery('victim')).toBe(false);
  });

  it('ip по умолчанию null, если не передан', async () => {
    const { service, auditRecord } = make();
    await service.revoke({ targetId: 'victim', reason: 'x', chairmanId: 'chief' });
    expect(auditRecord).toHaveBeenCalledWith(expect.objectContaining({ ip: null }));
  });
});
