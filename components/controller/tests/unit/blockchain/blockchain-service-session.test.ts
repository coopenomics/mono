/**
 * `BlockchainService` — одиночка с изменяемой сессией: вызывающие делают
 * `initialize(подписант, ключ)` и сразу `transact(...)`. Пока транзакция ждёт
 * ABI, параллельный запрос с другим подписантом вызывает `initialize()` снова.
 * Транзакция обязана уйти с той сессией, что была в момент её вызова, а не с
 * подменённой — иначе она подписывается чужим ключом.
 */
import { BlockchainService } from '~/infrastructure/blockchain/blockchain.service';

function deferred() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

function build() {
  const service = new BlockchainService({} as any, { read: jest.fn(), activeUrl: jest.fn() } as any, {} as any);
  const abiGate = deferred();
  jest.spyOn(service as any, 'formActionFromAbi').mockImplementation(async (action: unknown) => {
    await abiGate.promise;
    return action;
  });
  const sessionA = { transact: jest.fn().mockResolvedValue({ from: 'A' }) };
  const sessionB = { transact: jest.fn().mockResolvedValue({ from: 'B' }) };
  (service as any).session = sessionA;
  return { service, abiGate, sessionA, sessionB };
}

const ACTION = { account: 'marketplace', name: 'issuestmt', authorization: [{ actor: 'voskhod', permission: 'active' }], data: {} };

describe('BlockchainService.transact — сессия фиксируется в момент вызова', () => {
  it('одно действие: подмена сессии во время ожидания ABI не меняет подписанта', async () => {
    const { service, abiGate, sessionA, sessionB } = build();
    const pending = service.transact(ACTION);
    (service as any).session = sessionB;
    abiGate.release();

    await expect(pending).resolves.toEqual({ from: 'A' });
    expect(sessionA.transact).toHaveBeenCalledWith({ action: ACTION }, { broadcast: true });
    expect(sessionB.transact).not.toHaveBeenCalled();
  });

  it('несколько действий: транзакция уходит с сессией момента вызова', async () => {
    const { service, abiGate, sessionA, sessionB } = build();
    const pending = service.transact([ACTION, ACTION], false);
    (service as any).session = sessionB;
    abiGate.release();

    await expect(pending).resolves.toEqual({ from: 'A' });
    expect(sessionA.transact).toHaveBeenCalledWith({ actions: [ACTION, ACTION] }, { broadcast: false });
    expect(sessionB.transact).not.toHaveBeenCalled();
  });
});
