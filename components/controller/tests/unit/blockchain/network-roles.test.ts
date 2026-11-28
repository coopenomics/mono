/**
 * Роли сети из цепи (28.11.2026): ведущего называет строка `network` реестра,
 * операторов — таблица `operators`. Цепь на прежних контрактах таблиц не имеет:
 * ведущий тогда — имя по умолчанию, оператором считается ведущий. Узел
 * спрашивает роли на каждом запросе сведений о системе, поэтому ответ помнится.
 */
import { BlockchainService } from '~/infrastructure/blockchain/blockchain.service';

function build() {
  const service = new BlockchainService({ setContext: jest.fn() } as any, { read: jest.fn(), activeUrl: jest.fn() } as any, {} as any);
  const query = jest.spyOn(service, 'query');
  const getSingleRow = jest.spyOn(service, 'getSingleRow');
  return { service, query, getSingleRow };
}

const noTable = (table: string) => new Error(`Table ${table} is not specified in the ABI`);

describe('роли сети из цепи', () => {
  it('happy: ведущий — из строки network реестра', async () => {
    const { service, query } = build();
    query.mockResolvedValue([{ lead: 'hubcoop' }]);

    expect(await service.getNetworkLead()).toBe('hubcoop');
    expect(query).toHaveBeenCalledWith('registrator', 'registrator', 'network', { maxRows: 1 });
  });

  it('side: строки network нет либо таблицы нет в ABI — ведущий по умолчанию', async () => {
    const empty = build();
    empty.query.mockResolvedValue([]);
    expect(await empty.service.getNetworkLead()).toBe('voskhod');

    const old = build();
    old.query.mockRejectedValue(noTable('network'));
    expect(await old.service.getNetworkLead()).toBe('voskhod');
  });

  it('break: цепь не ответила — отказ выходит наружу, ведущий по умолчанию не подставляется', async () => {
    const { service, query } = build();
    query.mockRejectedValue(new Error('fetch failed'));

    await expect(service.getNetworkLead()).rejects.toThrow('fetch failed');
  });

  it('happy: оператор — кооператив из таблицы operators; кооператива в ней нет — не оператор', async () => {
    const { service, getSingleRow } = build();
    getSingleRow.mockImplementation(async (_c, _s, _t, key) =>
      String(key) === 'hubcoop' ? ({ username: 'hubcoop', appointed_at: '2026-11-28T00:00:00' } as any) : null,
    );

    expect(await service.isNetworkOperator('hubcoop')).toBe(true);
    expect(await service.isNetworkOperator('partner1')).toBe(false);
  });

  it('side: таблицы operators нет в ABI — оператором считается только ведущий', async () => {
    const { service, query, getSingleRow } = build();
    query.mockRejectedValue(noTable('network'));
    getSingleRow.mockRejectedValue(noTable('operators'));

    expect(await service.isNetworkOperator('voskhod')).toBe(true);
    expect(await service.isNetworkOperator('partner1')).toBe(false);
  });

  it('side: ответ о роли помнится — повторный вопрос цепь не читает', async () => {
    const { service, query, getSingleRow } = build();
    query.mockResolvedValue([{ lead: 'hubcoop' }]);
    getSingleRow.mockResolvedValue({ username: 'hubcoop' } as any);

    await service.getNetworkLead();
    await service.getNetworkLead();
    await service.isNetworkOperator('hubcoop');
    await service.isNetworkOperator('hubcoop');

    expect(query).toHaveBeenCalledTimes(1);
    expect(getSingleRow).toHaveBeenCalledTimes(1);
  });
});
