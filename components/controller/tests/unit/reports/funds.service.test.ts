/**
 * Фонды кооператива на столе бухгалтера (задача 99D-24; реестр fund.wallets,
 * случаи fnd.wal.backend.*).
 *
 * Реестр фондов — пять строк настроек контракта fund; остаток — кошелёк учётной
 * книги; обороты и история — операции учётной книги, у которых кошелёк фонда
 * стоит источником или получателем. Транзит через фонд (перевод с пула на фонд
 * перед выплатой) в историю не попадает — остаток фонда он не меняет.
 */
import { FundsService } from '~/extensions/reports/application/services/funds.service';

const COOP = 'voskhod';

const FUNDS = [
  { id: 1, coopname: COOP, kind: 'accum', name: 'Неделимый фонд', description: '', percent: 10_000, wallet: 'w.fnd.indiv' },
  { id: 2, coopname: COOP, kind: 'accum', name: 'Резервный фонд', description: '', percent: 150_000, wallet: 'w.fnd.resrv' },
  { id: 3, coopname: COOP, kind: 'accum', name: 'Фонд развития кооперации', description: '', percent: 50_000, wallet: 'w.fnd.devel' },
  { id: 4, coopname: COOP, kind: 'expend', name: 'Фонд обеспечения хозяйственной деятельности', description: '', percent: 0, wallet: 'w.sov.expns' },
  { id: 5, coopname: COOP, kind: 'expend', name: 'Фонд взаимного обеспечения', description: '', percent: 0, wallet: 'w.fnd.mutual' },
];

let seq = 0;
function op(code: string, quantity: string, extra: Record<string, unknown> = {}) {
  seq += 1;
  return {
    globalSequence: String(seq),
    blockNum: seq,
    coopname: COOP,
    action: 'apply',
    operationCode: code,
    processHash: 'a'.repeat(64),
    username: 'krg',
    quantity,
    memo: null,
    createdAt: new Date('2026-11-03T10:00:00Z'),
    ...extra,
  };
}

/** История учётной книги по кодам операций: фильтр по кодам — как у настоящего порта. */
function makeService(history: ReturnType<typeof op>[], wallets: Array<{ id: string; available: string }> = []) {
  const registry = {
    listFunds: jest.fn(async () => FUNDS.map((f) => ({ ...f }))),
    editFund: jest.fn(async () => ({ response: {} })),
  };
  const ledger = {
    getHistory: jest.fn(async (filter: { operationCodes?: string[]; page?: number; limit?: number }) => {
      const codes = new Set(filter.operationCodes ?? []);
      const items = history.filter((h) => codes.has(h.operationCode));
      const limit = filter.limit ?? 50;
      const page = filter.page ?? 1;
      return {
        items: items.slice((page - 1) * limit, page * limit),
        totalCount: items.length,
        totalPages: Math.max(1, Math.ceil(items.length / limit)),
        currentPage: page,
      };
    }),
    getWallets: jest.fn(async () => wallets.map((w) => ({ ...w, name: w.id }))),
    getAccounts: jest.fn(async () => []),
  };
  const service = new FundsService(registry as never, ledger as never);
  return { service, registry, ledger };
}

describe('fnd.wal.backend.01 — реестр фондов: остатки по кошелькам, обороты по операциям', () => {
  it('пять фондов с кошельками, остаток из кошелька, обороты по направлению операции, транзит не считается', async () => {
    const { service } = makeService(
      [
        op('o.fnd.indiv', '47.6190 RUB'),
        op('o.fnd.resrv', '714.2857 RUB'),
        op('o.fnd.devel', '238.0953 RUB'),
        // Расход участка: транзит на фонд и списание с фонда одной транзакцией.
        op('o.brn.tofund', '500.0000 RUB'),
        op('o.brn.spend', '500.0000 RUB'),
        // Возврат аванса: на фонд и обратно в пул — оба транзитные для истории,
        // но возврат меняет остаток фонда и считается поступлением.
        op('o.brn.expret', '100.0000 RUB'),
        op('o.brn.fmfund', '100.0000 RUB'),
      ],
      [
        { id: 'w.fnd.indiv', available: '47.6190 RUB' },
        { id: 'w.fnd.resrv', available: '714.2857 RUB' },
        { id: 'w.sov.expns', available: '127500.0000 RUB' },
      ],
    );
    const view = await service.registryView({ coopname: COOP });
    expect(view.funds.map((f) => f.wallet)).toEqual(['w.fnd.indiv', 'w.fnd.resrv', 'w.fnd.devel', 'w.sov.expns', 'w.fnd.mutual']);
    expect(view.funds.map((f) => f.account)).toEqual([86_000, 86_000, 86_000, 86_000, 86_000]);

    const [indiv, reserve, devel, economic, mutual] = view.funds;
    expect(indiv.percent).toBe(1);
    expect(indiv.available).toBe('47.6190 RUB');
    expect(indiv.income).toBe('47.6190 RUB');
    expect(reserve.income).toBe('714.2857 RUB');
    // У фонда без движений остаток и обороты — нули в валюте кооператива.
    expect(devel.available).toBe('0.0000 RUB');
    expect(mutual.income).toBe('0.0000 RUB');
    // Хозяйственный фонд: списание 500 и возврат аванса 100; транзитные переводы не считаются.
    expect(economic.available).toBe('127500.0000 RUB');
    expect(economic.outcome).toBe('500.0000 RUB');
    expect(economic.income).toBe('100.0000 RUB');
  });
});

describe('fnd.wal.backend.02 — история фонда: знак суммы, вторая сторона, без транзита', () => {
  it('списание со знаком минус, поступление — плюс; транзитные коды в истории не запрашиваются', async () => {
    const { service, ledger } = makeService([
      op('o.brn.spend', '500.0000 RUB'),
      op('o.brn.expret', '100.0000 RUB'),
      op('o.brn.tofund', '500.0000 RUB'),
    ]);
    const page = await service.history({ coopname: COOP, fund_id: 4 }, { page: 1, limit: 50, sortOrder: 'DESC' });
    expect(page.totalCount).toBe(2);
    const spend = page.items.find((m) => m.operation_code === 'o.brn.spend');
    const back = page.items.find((m) => m.operation_code === 'o.brn.expret');
    expect(spend?.amount).toBe('-500.0000 RUB');
    expect(spend?.direction).toBe('out');
    expect(spend?.counterparty_wallet).toBeNull();
    expect(back?.amount).toBe('100.0000 RUB');
    expect(back?.direction).toBe('in');
    expect(back?.counterparty_wallet).toBe('w.exp.adv');
    expect(spend?.process_type).toBe('p.brn.spend');

    const requested = (ledger.getHistory.mock.calls[0]![0] as { operationCodes: string[] }).operationCodes;
    expect(requested).not.toContain('o.brn.tofund');
    expect(requested).not.toContain('o.brn.fmfund');
    expect(requested).toContain('o.sov.spend');
  });

  it('фонда с таким номером нет — отказ с кодом', async () => {
    const { service } = makeService([]);
    await expect(service.history({ coopname: COOP, fund_id: 9 } as never)).rejects.toMatchObject({ code: 'REPORTS_FUND_NOT_FOUND' });
  });
});

describe('fnd.wal.backend.03 — правка фонда председателем: правила до цепи', () => {
  it('процент и описание передаются в цепь в шкале контракта от имени председателя', async () => {
    const { service, registry } = makeService([]);
    await service.editFund({ coopname: COOP, fund_id: 2, description: 'Резерв', percent: 16.5 }, 'ant');
    expect(registry.editFund).toHaveBeenCalledWith({
      coopname: COOP,
      username: 'ant',
      type: 'accumulation',
      fund_id: 2,
      contract: '',
      name: 'Резервный фонд',
      description: 'Резерв',
      percent: 165_000,
    });
  });

  it('сумма процентов фондов накопления выше 100 % — отказ до цепи', async () => {
    const { service, registry } = makeService([]);
    // Остальные фонды накопления дают 6 %; 95 % сверх них — перебор.
    await expect(service.editFund({ coopname: COOP, fund_id: 2, description: '', percent: 95 }, 'ant'))
      .rejects.toMatchObject({ code: 'REPORTS_FUND_PERCENT_SUM_EXCEEDED' });
    expect(registry.editFund).not.toHaveBeenCalled();
  });

  it('нулевой процент у фонда накопления и процент у фонда списания — отказы с кодами', async () => {
    const { service, registry } = makeService([]);
    await expect(service.editFund({ coopname: COOP, fund_id: 1, description: '', percent: 0 }, 'ant'))
      .rejects.toMatchObject({ code: 'REPORTS_FUND_PERCENT_INVALID' });
    await expect(service.editFund({ coopname: COOP, fund_id: 5, description: '', percent: 1 }, 'ant'))
      .rejects.toMatchObject({ code: 'REPORTS_FUND_PERCENT_NOT_ALLOWED' });
    expect(registry.editFund).not.toHaveBeenCalled();
  });

  it('фонд списания: описание меняется, процент 0 проходит', async () => {
    const { service, registry } = makeService([]);
    await service.editFund({ coopname: COOP, fund_id: 5, description: 'Материальная помощь', percent: 0 }, 'ant');
    expect(registry.editFund).toHaveBeenCalledWith(expect.objectContaining({ type: 'expend', fund_id: 5, percent: 0 }));
  });
});
