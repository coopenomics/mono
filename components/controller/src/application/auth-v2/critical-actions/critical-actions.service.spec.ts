import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  CriticalActionStatus,
  CriticalActionType,
  type ICriticalActionNotifier,
  type IPendingCriticalActionsRepository,
  type NewCriticalAction,
  type PendingCriticalAction,
} from '~/domain/auth-v2/ports/pending-critical-actions.port';
import { CriticalActionsService, REQUIRED_CONFIRMATIONS } from './critical-actions.service';
import type { AuditService } from '../audit/audit.service';

function action(over: Partial<PendingCriticalAction> = {}): PendingCriticalAction {
  return {
    id: 'a1',
    actionType: CriticalActionType.ExcludeParticipant,
    actorId: 'chief',
    targetId: 'victim',
    payload: { reason: 'x' },
    status: CriticalActionStatus.Pending,
    confirmations: [{ by: 'chief', at: '2026-06-11T00:00:00.000Z' }],
    createdAt: '2026-06-11T00:00:00.000Z',
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    finalizedAt: null,
    ...over,
  };
}

function makeService(repoOver: Partial<IPendingCriticalActionsRepository> = {}) {
  const update = jest.fn(async () => undefined);
  const create = jest.fn(async (i: NewCriticalAction): Promise<PendingCriticalAction> =>
    action({ actionType: i.actionType, actorId: i.actorId, targetId: i.targetId, payload: i.payload, confirmations: i.confirmations, expiresAt: i.expiresAt }));
  const repo: IPendingCriticalActionsRepository = {
    create,
    findById: async () => null,
    update,
    listExpired: async () => [],
    ...repoOver,
  };
  const notify = jest.fn(async () => undefined);
  const notifier: ICriticalActionNotifier = { notifyPending: notify };
  const record = jest.fn(async () => undefined);
  const audit = { record } as unknown as AuditService;
  return { service: new CriticalActionsService(repo, notifier, audit), update, create, notify, record };
}

describe('CriticalActionsService — multi-party (Story 6.8)', () => {
  it('initiate создаёт pending с подписью инициатора, окном ≤24ч и зовёт совет', async () => {
    const { service, create, notify } = makeService();
    const a = await service.initiate({ actionType: CriticalActionType.ExcludeParticipant, actorId: 'chief', targetId: 'victim', payload: { reason: 'fraud' } });
    expect(create).toHaveBeenCalled();
    expect(a.confirmations).toEqual([expect.objectContaining({ by: 'chief' })]);
    expect(new Date(a.expiresAt).getTime()).toBeGreaterThan(Date.now());
    expect(notify).toHaveBeenCalledWith(a);
  });

  it('вторая подпись члена совета (≠ инициатор) финализирует + аудит обоих подписантов с payload_hash', async () => {
    const { service, update, record } = makeService({ findById: async () => action() });
    const a = await service.confirm('a1', 'councilor');
    expect(a.status).toBe(CriticalActionStatus.Confirmed);
    expect(a.confirmations).toHaveLength(REQUIRED_CONFIRMATIONS);
    expect(update).toHaveBeenCalled();
    expect(record).toHaveBeenCalledWith(expect.objectContaining({
      event: 'CriticalActionConfirmed',
      result: 'success',
      context: expect.objectContaining({ initiator_id: 'chief', payload_hash: expect.any(String) }),
    }));
  });

  it('инициатор не может подтвердить собственное действие', async () => {
    const { service, record } = makeService({ findById: async () => action() });
    await expect(service.confirm('a1', 'chief')).rejects.toBeInstanceOf(ConflictException);
    expect(record).not.toHaveBeenCalled();
  });

  it('повторная подпись тем же членом совета отклоняется (защитная проверка до кворума)', async () => {
    // pending-действие, где councilor уже значится среди подписантов.
    const withCouncilor = action({ confirmations: [{ by: 'chief', at: 't0' }, { by: 'councilor', at: 't1' }] });
    const { service } = makeService({ findById: async () => withCouncilor });
    await expect(service.confirm('a1', 'councilor')).rejects.toBeInstanceOf(ConflictException);
  });

  it('подтверждение истёкшего действия отклоняется и помечает expired + аудит', async () => {
    const expired = action({ expiresAt: new Date(Date.now() - 1000).toISOString() });
    const { service, update, record } = makeService({ findById: async () => expired });
    await expect(service.confirm('a1', 'councilor')).rejects.toBeInstanceOf(ConflictException);
    expect(update).toHaveBeenCalled();
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ event: 'CriticalActionExpired', result: 'failure' }));
  });

  it('подтверждение не-pending действия отклоняется', async () => {
    const { service } = makeService({ findById: async () => action({ status: CriticalActionStatus.Confirmed }) });
    await expect(service.confirm('a1', 'councilor')).rejects.toBeInstanceOf(ConflictException);
  });

  it('подтверждение несуществующего действия → NotFound', async () => {
    const { service } = makeService({ findById: async () => null });
    await expect(service.confirm('nope', 'councilor')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('expireStale отменяет все истёкшие pending и аудитит каждый', async () => {
    const stale = [action({ id: 'e1' }), action({ id: 'e2' })];
    const { service, update, record } = makeService({ listExpired: async () => stale });
    await service.expireStale();
    expect(update).toHaveBeenCalledTimes(2);
    expect(record).toHaveBeenCalledTimes(2);
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ event: 'CriticalActionExpired' }));
  });
});
