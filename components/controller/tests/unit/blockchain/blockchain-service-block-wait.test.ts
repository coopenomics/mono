/**
 * Транзакция отвечает после факта из цепи (ADR-009): `BlockchainService.transact`
 * возвращается, когда узел разобрал блок транзакции целиком, — любая мутация
 * отвечает уже изменёнными данными, без пауз и без перечня таблиц.
 *
 * Инварианты:
 *   - ждём блок, в который попала транзакция (response.processed.block_num),
 *     не дольше BLOCKCHAIN_WRITE_WAIT_DELTA_MS;
 *   - не дождались — ответ всё равно уходит, с предупреждением в журнал;
 *   - изнутри разбора цепи не ждём: обработчик дельты, ждущий свой же блок,
 *     заблокировал бы потребителя;
 *   - транзакция без broadcast и ответ без номера блока — ждать нечего;
 *   - сервис без гейта (мигратор) работает как раньше.
 */
jest.mock('~/config/config', () => ({
  __esModule: true,
  default: {
    ...jest.requireActual('~/config/config').default,
    blockchain: { ...jest.requireActual('~/config/config').default.blockchain, write_wait_delta_ms: 1234 },
  },
}));

import { BlockchainService } from '~/infrastructure/blockchain/blockchain.service';
import { runInChainDispatch } from '~/infrastructure/blockchain/chain-dispatch-context';

const ACTION = { account: 'wallet', name: 'deposit', authorization: [{ actor: 'voskhod', permission: 'active' }], data: {} };
const RESULT = { response: { processed: { block_num: 777 } } };

function build(opts: { processed?: boolean; withGate?: boolean; result?: unknown } = {}) {
  const logger = { debug: jest.fn(), warn: jest.fn(), setContext: jest.fn() } as any;
  const gate = { waitProcessed: jest.fn().mockResolvedValue(opts.processed ?? true) } as any;
  const service = new BlockchainService(
    logger,
    { read: jest.fn(), activeUrl: jest.fn() } as any,
    {} as any,
    opts.withGate === false ? null : gate
  );
  jest.spyOn(service as any, 'formActionFromAbi').mockImplementation(async (action: unknown) => action);
  (service as any).session = { transact: jest.fn().mockResolvedValue(opts.result ?? RESULT) };
  return { service, gate, logger };
}

describe('BlockchainService.transact — ответ после разбора блока транзакции', () => {
  it('ждёт разбора блока своей транзакции в пределах BLOCKCHAIN_WRITE_WAIT_DELTA_MS', async () => {
    const { service, gate, logger } = build();

    await expect(service.transact(ACTION)).resolves.toBe(RESULT);
    expect(gate.waitProcessed).toHaveBeenCalledWith(777, 1234);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('ответ приходит только после разбора блока', async () => {
    const { service, gate } = build();
    let release!: (v: boolean) => void;
    gate.waitProcessed.mockReturnValue(new Promise<boolean>((r) => (release = r)));
    let settled = false;
    const pending = service.transact([ACTION]).then(() => (settled = true));

    await new Promise((r) => setImmediate(r));
    expect(settled).toBe(false);
    release(true);
    await pending;
    expect(settled).toBe(true);
  });

  it('не дождались — ответ уходит как есть, с предупреждением', async () => {
    const { service, logger } = build({ processed: false });

    await expect(service.transact(ACTION)).resolves.toBe(RESULT);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('не разобран'));
  });

  it('изнутри разбора цепи не ждёт — иначе обработчик заблокировал бы потребителя', async () => {
    const { service, gate } = build();

    await runInChainDispatch(() => service.transact(ACTION));
    expect(gate.waitProcessed).not.toHaveBeenCalled();
  });

  it('транзакция без broadcast — ждать нечего', async () => {
    const { service, gate } = build();

    await service.transact(ACTION, false);
    expect(gate.waitProcessed).not.toHaveBeenCalled();
  });

  it('узел не сообщил блок — ждать нечего', async () => {
    const { service, gate } = build({ result: { response: {} } });

    await service.transact(ACTION);
    expect(gate.waitProcessed).not.toHaveBeenCalled();
  });

  it('без гейта (мигратор собирает сервис руками) — работает как раньше', async () => {
    const { service } = build({ withGate: false });

    await expect(service.transact(ACTION)).resolves.toBe(RESULT);
  });
});
