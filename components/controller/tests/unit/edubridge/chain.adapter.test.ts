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
    await adapter.signAnnex({ coopname: 'voskhod', username: 'ant', course_id: 7, contract_hash: 'H', annex_hash: 'A', annex: doc({ a: 1 }) });
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
