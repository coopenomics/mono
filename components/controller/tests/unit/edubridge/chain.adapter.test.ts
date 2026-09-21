/** Адаптер цепи edubridge: документы уходят в контракт с `meta` строкой JSON — иначе синхронизатор одобрений совета их не разбирает. */
import { EdubridgeChainAdapter } from '~/extensions/edubridge/infrastructure/adapters/edubridge-chain.adapter';

function make() {
  const chain = { initialize: jest.fn(), transact: jest.fn(async (a: any) => a) } as any;
  const vault = { getWif: jest.fn(async () => 'WIF') } as any;
  return { adapter: new EdubridgeChainAdapter(chain, vault), chain, vault };
}

const doc = (meta: unknown) => ({ version: '1.1.0', hash: 'H', doc_hash: 'D', meta_hash: 'M', meta, signatures: [] }) as any;

describe('EdubridgeChainAdapter — документ в цепь', () => {
  it('signcontract: meta-объект сериализуется в строку JSON, остальные поля не трогаются', async () => {
    const { adapter, chain } = make();
    await adapter.signContract({ coopname: 'voskhod', username: 'ant', contract_hash: 'H', contract: doc({ title: 'Договор', registry_id: 3006 }) });
    const action = chain.transact.mock.calls[0][0];
    expect(action.name).toBe('signcontract');
    expect(action.data.contract.meta).toBe(JSON.stringify({ title: 'Договор', registry_id: 3006 }));
    expect(action.data.contract.hash).toBe('H');
    expect(action.data.contract_hash).toBe('H');
  });

  it('signannex и submitrid сериализуют annex/statement; уже строковая meta остаётся как есть', async () => {
    const { adapter, chain } = make();
    await adapter.signAnnex({ coopname: 'voskhod', username: 'ant', course_id: 7, annex_hash: 'A', annex: doc({ a: 1 }) });
    await adapter.submitRid({ coopname: 'voskhod', username: 'ant', rid_hash: 'R', assignment_id: 1, amount: '1.0000 RUB', rid_type: 'other', statement: doc('{"s":1}') } as any);
    expect(chain.transact.mock.calls[0][0].data.annex.meta).toBe('{"a":1}');
    expect(chain.transact.mock.calls[1][0].data.statement.meta).toBe('{"s":1}');
  });

  it('без meta уходит «{}», а не «undefined»', async () => {
    const { adapter, chain } = make();
    await adapter.signContract({ coopname: 'voskhod', username: 'ant', contract_hash: 'H', contract: doc(undefined) });
    expect(chain.transact.mock.calls[0][0].data.contract.meta).toBe('{}');
  });

  it('нет ключа кооператива в хранилище — отказ до отправки', async () => {
    const { adapter, chain, vault } = make();
    vault.getWif.mockResolvedValueOnce(null);
    await expect(adapter.signContract({ coopname: 'voskhod', username: 'ant', contract_hash: 'H', contract: doc({}) })).rejects.toThrow(/приватный ключ/);
    expect(chain.transact).not.toHaveBeenCalled();
  });
});

describe('EdubridgeChainAdapter — состав транзакций подписки', () => {
  const open = { kind: 'open' as const, data: { coopname: 'voskhod', sub_hash: 'S' } as any };
  const charge = { coopname: 'voskhod', username: 'ant', sub_hash: 'S', amount: '1000.0000 RUB' } as any;
  const names = (chain: any) => chain.transact.mock.calls[0][0].map((a: any) => a.name);

  it('оплата с конвертацией: convert → opensub → chargefee → allotfee, заявление едет в convert строкой', async () => {
    const { adapter, chain } = make();
    await adapter.convertAndSubscribe({ coopname: 'voskhod', username: 'ant', amount: '1000.0000 RUB', statement: doc({ a: 1 }) } as any, open, charge, { allot: '800.0000 RUB' });
    expect(names(chain)).toEqual(['convert', 'opensub', 'chargefee', 'allotfee']);
    const [convert, , , allot] = chain.transact.mock.calls[0][0];
    expect(convert.data.statement.meta).toBe('{"a":1}');
    expect(allot.data).toEqual({ coopname: 'voskhod', sub_hash: 'S', amount: '800.0000 RUB' });
  });

  it('оплата целиком с кошелька программы: заявление публикует regstatement', async () => {
    const { adapter, chain } = make();
    await adapter.convertAndSubscribe(null, open, charge, { allot: '800.0000 RUB', statement: { coopname: 'voskhod', username: 'ant', statement: doc({ b: 2 }) } as any });
    expect(names(chain)).toEqual(['regstatement', 'opensub', 'chargefee', 'allotfee']);
    expect(chain.transact.mock.calls[0][0][0].data.statement.meta).toBe('{"b":2}');
  });

  it('пока идёт гарантийный срок курса: взнос удерживается сразу после списания', async () => {
    const { adapter, chain } = make();
    await adapter.convertAndSubscribe(null, open, charge, { lock: '1000.0000 RUB' });
    expect(names(chain)).toEqual(['opensub', 'chargefee', 'lockfee']);
    expect(chain.transact.mock.calls[0][0][2].data).toEqual({ coopname: 'voskhod', sub_hash: 'S', amount: '1000.0000 RUB' });
  });

  it('разблокировка по сроку: unlockfee, затем резерв преподавателям той же транзакцией', async () => {
    const { adapter, chain } = make();
    await adapter.unlockFee({ coopname: 'voskhod', sub_hash: 'S', amount: '1000.0000 RUB', allot: '800.0000 RUB' });
    expect(names(chain)).toEqual(['unlockfee', 'allotfee']);
    await adapter.unlockFee({ coopname: 'voskhod', sub_hash: 'S', amount: '1000.0000 RUB' });
    expect(chain.transact.mock.calls[1][0].map((a: any) => a.name)).toEqual(['unlockfee']);
  });

  it('резерв по закрытой подписке — отдельным действием', async () => {
    const { adapter, chain } = make();
    await adapter.allotReserve({ coopname: 'voskhod', sub_hash: 'S', amount: '800.0000 RUB' });
    expect(chain.transact.mock.calls[0][0].name).toBe('allotfee');
  });

  it('нулевой резерв в цепь не идёт', async () => {
    const { adapter, chain } = make();
    await adapter.convertAndSubscribe(null, open, charge, { allot: '0.0000 RUB' });
    expect(names(chain)).toEqual(['opensub', 'chargefee']);
  });

  it('отмена с высвобождением: freereserve раньше cancelsub — возврат идёт из фонда', async () => {
    const { adapter, chain } = make();
    await adapter.cancelSubscription({ coopname: 'voskhod', username: 'ant', sub_hash: 'S', refund: '250.0000 RUB', to_share: false } as any, '400.0000 RUB');
    expect(names(chain)).toEqual(['freereserve', 'cancelsub']);
  });

  it('отмена без резерва — одно действие', async () => {
    const { adapter, chain } = make();
    await adapter.cancelSubscription({ coopname: 'voskhod', username: 'ant', sub_hash: 'S', refund: '0.0000 RUB', to_share: false } as any);
    expect(chain.transact.mock.calls[0][0].name).toBe('cancelsub');
  });
});
