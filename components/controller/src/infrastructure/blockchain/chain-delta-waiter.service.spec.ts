/** Ответ мутации после факта из цепи (ADR-009): ожидание дельты своей транзакции. */
jest.mock('~/config', () => ({ config: { blockchain: { write_wait_delta_ms: 50 } } }));
import { ChainDeltaWaiterService } from './chain-delta-waiter.service';

const delta = (over: Partial<Record<string, unknown>> = {}) =>
  ({ chain_id: 'c', block_id: 'b', code: 'edubridge', scope: 'voskhod', table: 'educontracts', primary_key: '1', block_num: 100, present: true, value: { username: 'ant' }, ...over }) as any;

describe('ChainDeltaWaiterService', () => {
  it('будит ожидание дельтой своего блока и той же таблицы', async () => {
    const waiter = new ChainDeltaWaiterService();
    const pending = waiter.waitForDelta({ code: 'edubridge', table: 'educontracts', scope: 'voskhod', minBlockNum: 100, timeoutMs: 1000 });
    waiter.wake(delta());
    await expect(pending).resolves.toMatchObject({ code: 'edubridge', table: 'educontracts', block_num: 100, present: true });
  });

  it('дельта раньшего блока, чужой таблицы, области или строки не будит', async () => {
    const waiter = new ChainDeltaWaiterService();
    const pending = waiter.waitForDelta({
      code: 'edubridge',
      table: 'educontracts',
      scope: 'voskhod',
      minBlockNum: 100,
      timeoutMs: 40,
      match: (d) => d.value?.username === 'ant',
    });
    waiter.wake(delta({ block_num: 99 }));
    waiter.wake(delta({ table: 'edusubs' }));
    waiter.wake(delta({ scope: 'other' }));
    waiter.wake(delta({ value: { username: 'bob' } }));
    await expect(pending).resolves.toBeNull();
  });

  it('не дождались — null по таймауту узла, ожидание не остаётся в памяти', async () => {
    const waiter = new ChainDeltaWaiterService();
    await expect(waiter.waitForDelta({ code: 'soviet', minBlockNum: 1 })).resolves.toBeNull();
    expect((waiter as any).waiters.get('soviet').size).toBe(0);
  });

  it('номер блока берётся из результата транзакции', () => {
    const waiter = new ChainDeltaWaiterService();
    expect(waiter.blockOf({ response: { processed: { block_num: 54696 } } })).toBe(54696);
    expect(waiter.blockOf({ processed: { block_num: 7 } })).toBe(7);
    expect(waiter.blockOf(undefined)).toBe(0);
  });

  it('afterTransact ждёт все таблицы транзакции из её блока: пришли все — true, не пришла одна — false', async () => {
    const waiter = new ChainDeltaWaiterService();
    const tx = { response: { processed: { block_num: 100 } } };
    const both = waiter.afterTransact(tx, [
      { code: 'ledger2', table: 'userwallets', timeoutMs: 1000 },
      { code: 'capital', table: 'contributors', timeoutMs: 1000 },
    ]);
    waiter.wake(delta({ code: 'ledger2', table: 'userwallets' }));
    waiter.wake(delta({ code: 'capital', table: 'contributors' }));
    await expect(both).resolves.toBe(true);

    const one = waiter.afterTransact(tx, [
      { code: 'ledger2', table: 'userwallets', timeoutMs: 1000 },
      { code: 'capital', table: 'contributors', timeoutMs: 40 },
    ]);
    waiter.wake(delta({ code: 'ledger2', table: 'userwallets' }));
    await expect(one).resolves.toBe(false);
  });

  it('afterTransact без номера блока в ответе узла — не ждёт', async () => {
    await expect(new ChainDeltaWaiterService().afterTransact({}, [{ code: 'ledger2' }])).resolves.toBe(false);
  });
});

