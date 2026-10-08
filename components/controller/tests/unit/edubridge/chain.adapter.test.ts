/** Адаптер цепи edubridge: документы уходят в контракт с `meta` строкой JSON — иначе синхронизатор одобрений совета их не разбирает. */
import { EdubridgeChainAdapter } from '~/extensions/edubridge/infrastructure/adapters/edubridge-chain.adapter';
import { Cooperative } from 'cooptypes';

function make() {
  const chain = { initialize: jest.fn(), transact: jest.fn(async (a: any) => a) } as any;
  const vault = { getWif: jest.fn(async () => 'WIF') } as any;
  return { adapter: new EdubridgeChainAdapter(chain, vault), chain, vault };
}

const doc = (meta: unknown) => ({ version: '1.1.0', hash: 'H', doc_hash: 'D', meta_hash: 'M', meta, signatures: [] }) as any;

describe('EdubridgeChainAdapter — документ в цепь', () => {
  it('signcontract: meta-объект сериализуется в строку JSON, остальные поля не трогаются', async () => {
    const { adapter, chain } = make();
    await adapter.signContract({ coopname: 'voskhod', username: 'ant', contract_hash: 'H', contract: doc({ title: 'Договор', registry_id: Cooperative.Registry.EducationParticipationContract.registry_id }) });
    const action = chain.transact.mock.calls[0][0];
    expect(action.name).toBe('signcontract');
    expect(action.data.contract.meta).toBe(JSON.stringify({ title: 'Договор', registry_id: Cooperative.Registry.EducationParticipationContract.registry_id }));
    expect(action.data.contract.hash).toBe('H');
    expect(action.data.contract_hash).toBe('H');
  });

  it('submitrid сериализует statement; уже строковая meta остаётся как есть', async () => {
    const { adapter, chain } = make();
    await adapter.submitRid({ coopname: 'voskhod', username: 'ant', rid_hash: 'R', assignment_id: 1, amount: '1.0000 RUB', rid_type: 'other', statement: doc('{"s":1}') } as any);
    expect(chain.transact.mock.calls[0][0].data.statement.meta).toBe('{"s":1}');
  });

  it('wthshare уходит действием edubridge::wthshare с заявлением, meta — строкой JSON', async () => {
    const { adapter, chain } = make();
    await adapter.withdrawShare({ coopname: 'voskhod', username: 'ant', amount: '1.0000 RUB', statement: doc({ amount: '1.0000 RUB' }) } as any);
    const action = chain.transact.mock.calls[0][0];
    expect(action.name).toBe('wthshare');
    expect(action.data.amount).toBe('1.0000 RUB');
    expect(action.data.statement.meta).toBe('{"amount":"1.0000 RUB"}');
  });

  it('допуск к курсу в цепь не уходит — действия для приложения к договору у адаптера нет', () => {
    const { adapter } = make();
    expect((adapter as any).signAnnex).toBeUndefined();
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
  const open = { coopname: 'voskhod', username: 'ant', sub_hash: 'S', learner_id: 1, course_id: 7, statement_hash: 'H' } as any;
  const charge = { coopname: 'voskhod', username: 'ant', sub_hash: 'S', period: 'month', expected: '1000.0000 RUB', statement_hash: 'H' } as any;
  const names = (chain: any, call = 0) => chain.transact.mock.calls[call][0].map((a: any) => a.name);

  it('оплата с конвертацией: convert → opensub → chargefee, заявление едет в convert строкой', async () => {
    const { adapter, chain } = make();
    await adapter.convertAndSubscribe({ coopname: 'voskhod', username: 'ant', amount: '1000.0000 RUB', statement: doc({ a: 1 }) } as any, open, charge);
    expect(names(chain)).toEqual(['convert', 'opensub', 'chargefee']);
    expect(chain.transact.mock.calls[0][0][0].data.statement.meta).toBe('{"a":1}');
  });

  it('взнос несёт период и сумму из заявления — суммы, срока и удержания в действии нет', async () => {
    const { adapter, chain } = make();
    await adapter.convertAndSubscribe(null, open, charge);
    const sent = chain.transact.mock.calls[0][0].find((a: any) => a.name === 'chargefee').data;
    expect(sent).toEqual({ coopname: 'voskhod', username: 'ant', sub_hash: 'S', period: 'month', expected: '1000.0000 RUB', statement_hash: 'H' });
    expect(names(chain)).not.toContain('lockfee');
  });

  it('оплата целиком с кошелька программы: заявление публикует regstatement', async () => {
    const { adapter, chain } = make();
    await adapter.convertAndSubscribe(null, open, charge, { statement: { coopname: 'voskhod', username: 'ant', statement: doc({ b: 2 }) } as any });
    expect(names(chain)).toEqual(['regstatement', 'opensub', 'chargefee']);
    expect(chain.transact.mock.calls[0][0][0].data.statement.meta).toBe('{"b":2}');
  });

  it('продление: подписка уже открыта, в транзакции только взнос', async () => {
    const { adapter, chain } = make();
    await adapter.convertAndSubscribe(null, null, charge);
    expect(names(chain)).toEqual(['chargefee']);
  });

  it('закрытие гарантийного срока и отмена уходят без сумм — их считает контракт', async () => {
    const { adapter, chain } = make();
    await adapter.unlockFee({ coopname: 'voskhod', sub_hash: 'S' });
    await adapter.cancelSubscription({ coopname: 'voskhod', username: 'ant', sub_hash: 'S', underfilled: false });
    const [unlock, cancel] = chain.transact.mock.calls.map((c: any) => c[0]);
    expect(unlock).toMatchObject({ name: 'unlockfee', data: { coopname: 'voskhod', sub_hash: 'S' } });
    expect(cancel).toMatchObject({ name: 'cancelsub', data: { coopname: 'voskhod', username: 'ant', sub_hash: 'S', underfilled: false } });
  });

  it('расчёт занятия: отчёт, расчёт по одной подписке и приём материалов без суммы', async () => {
    const { adapter, chain } = make();
    await adapter.openLesson({ coopname: 'voskhod', username: 'ant', rid_hash: 'R', assignment_id: 3, held_at: '2026-10-01T10:00:00', minutes: 60 });
    await adapter.chargeLesson({ coopname: 'voskhod', rid_hash: 'R', sub_hash: 'S' });
    await adapter.holdRid({ coopname: 'voskhod', username: 'ant', rid_hash: 'R', rid_type: 'lesson', act: doc({ c: 3 }) } as any);
    const sent = chain.transact.mock.calls.map((c: any) => c[0]);
    expect(sent.map((a: any) => a.name)).toEqual(['openlesson', 'chargelesson', 'holdrid']);
    expect(sent[2].data.amount).toBeUndefined();
    expect(sent[2].data.act.meta).toBe('{"c":3}');
  });
});
