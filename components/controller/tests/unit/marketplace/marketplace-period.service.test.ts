/**
 * Итог месяца участка на стороне ИСТОКА (задача 99D-22): сбор фактов месяца
 * (плановые расходы по сроку, служебные записки без записок по плану,
 * выплаченная материальная помощь), расчёт контрактом с зеркалированием строки
 * цепи, терпимость к повтору, стирание старых строк, ставка списания.
 * Реестр: mkt.order.keu.11.
 */
jest.mock('@coopenomics/extension-kit', () => {
  const actual = jest.requireActual('@coopenomics/extension-kit');
  return {
    ...actual,
    platformSettings: () => ({ coopname: 'voskhod', timezone: 'Europe/Moscow', frontendUrl: 'https://coop.test' }),
  };
});

import { MarketplacePeriodService } from '~/extensions/marketplace/application/services/marketplace-period.service';

const COOP = 'voskhod';
const BRANAME = 'krg';
/** Ноябрь 2026 по Москве. */
const NOVEMBER = 2026 * 12 + 11;

function toUnits(value: string): bigint {
  const [int = '0', frac = ''] = (String(value).trim().split(/\s+/)[0] ?? '0').split('.');
  return BigInt(int) * 10_000n + BigInt((frac + '0000').slice(0, 4));
}
function toAsset(units: bigint): string {
  const padded = units.toString().padStart(5, '0');
  return `${padded.slice(0, -4)}.${padded.slice(-4)} RUB`;
}

function memoryStore() {
  const rows = new Map<string, any>();
  const keyOf = (r: any) => `${r.coopname}/${r.braname}/${r.period}`;
  const matches = (row: any, where: Record<string, any>) =>
    Object.entries(where).every(([k, v]) => {
      if (v && typeof v === 'object' && 'operator' in v) {
        if (v.operator === 'is null') return row[k] == null;
        return true;
      }
      return row[k] === v;
    });
  return {
    rows,
    findOne: jest.fn(async (where: any) => [...rows.values()].find((r) => matches(r, where)) ?? null),
    find: jest.fn(async (where: any) => [...rows.values()].filter((r) => matches(r, where))),
    findAndCount: jest.fn(async (where: any, options: any = {}) => {
      let list = [...rows.values()].filter((r) => matches(r, where));
      if (options.order?.period === 'DESC') list = list.sort((a, b) => b.period - a.period);
      const offset = options.offset ?? 0;
      return [list.slice(offset, offset + (options.limit ?? list.length)), list.length];
    }),
    insert: jest.fn(async (fields: any) => {
      rows.set(keyOf(fields), { created_at: new Date(), updated_at: new Date(), ...fields });
      return rows.get(keyOf(fields));
    }),
    update: jest.fn(async (where: any, patch: any) => {
      const row = rows.get(keyOf(where));
      if (!row) return 0;
      rows.set(keyOf(where), { ...row, ...patch });
      return 1;
    }),
  };
}

const chainRow = (over: Record<string, unknown> = {}) => ({
  id: 1,
  braname: BRANAME,
  period: NOVEMBER,
  turnover: '3000000.0000 RUB',
  secured: '1140000.0000 RUB',
  planned: '200000.0000 RUB',
  memos: '50000.0000 RUB',
  aid_paid: '250000.0000 RUB',
  aid_reserve: '300000.0000 RUB',
  aid_unpaid: '50000.0000 RUB',
  expenses: '500000.0000 RUB',
  membership: '632911.3924 RUB',
  funds_amount: '132911.3924 RUB',
  branch_amount: '500000.0000 RUB',
  initiator_amount: '313380.7594 RUB',
  return_amount: '193707.8482 RUB',
  deficit: '0.0000 RUB',
  rate_branch: 166666,
  rate_funds: 44303,
  rate_initiator: 104460,
  initiator: 'chairkrg',
  closed_at: '2026-12-01T00:15:00',
  ...over,
});

function build(opts: {
  plans?: any[];
  history?: any[];
  aidPaid?: string;
  chainRows?: any[];
  closeError?: Error;
  deleteError?: Error;
} = {}) {
  const store = memoryStore();
  const chainRows = opts.chainRows ?? [chainRow()];
  const chainPort = {
    closePeriod: jest.fn(async () => {
      if (opts.closeError) throw opts.closeError;
      return {};
    }),
    listPeriods: jest.fn(async () => chainRows),
    deletePeriod: jest.fn(async () => {
      if (opts.deleteError) throw opts.deleteError;
      return {};
    }),
  };
  const expenseChassis = { listPlans: jest.fn(async () => opts.plans ?? []) };
  const ledger2History = {
    getHistory: jest.fn(async () => ({ items: opts.history ?? [], totalCount: (opts.history ?? []).length, totalPages: 1, currentPage: 1 })),
  };
  const economy = { assetToUnits: (v: string) => toUnits(v), unitsToAsset: (u: bigint) => toAsset(u) };
  const aidMirror = { paidWithin: jest.fn(async () => toUnits(opts.aidPaid ?? '0')) };
  const logger = { setContext: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn(), log: jest.fn(), debug: jest.fn() };
  const service = new MarketplacePeriodService(
    store as never,
    chainPort as never,
    expenseChassis as never,
    ledger2History as never,
    economy as never,
    aidMirror as never,
    logger as never
  );
  return { service, store, chainPort, expenseChassis, ledger2History, aidMirror, logger };
}

describe('mkt.order.keu.11 — факты месяца', () => {
  const inNov = new Date('2026-11-15T10:00:00.000Z');
  const inOct = new Date('2026-10-15T10:00:00.000Z');

  it('плановые расходы: записи участка со сроком внутри месяца, оплаченные и нет; чужой участок, без участка и другой месяц — нет', async () => {
    const { service, aidMirror, ledger2History } = build({
      plans: [
        { id: 1, branchName: BRANAME, title: 'Аренда', amount: '150000.0000 RUB', dueDate: inNov, proposalHash: null, paidAt: null },
        { id: 2, branchName: BRANAME, title: 'Транспорт', amount: '50000.0000 RUB', dueDate: inNov, proposalHash: 'p1', paidAt: inNov },
        { id: 3, branchName: BRANAME, title: 'Октябрь', amount: '999.0000 RUB', dueDate: inOct, proposalHash: null, paidAt: null },
        { id: 4, branchName: 'msk', title: 'Чужой', amount: '999.0000 RUB', dueDate: inNov, proposalHash: null, paidAt: null },
        { id: 5, branchName: null, title: 'Кооператив', amount: '999.0000 RUB', dueDate: inNov, proposalHash: null, paidAt: null },
        { id: 6, branchName: BRANAME, title: 'Без срока', amount: '999.0000 RUB', dueDate: null, proposalHash: null, paidAt: null },
      ],
    });
    const facts = await service.collectFacts(COOP, BRANAME, NOVEMBER);
    expect(facts.planned).toBe(toUnits('200000.0000'));
    // Границы месяца по Москве передаются в запросы помощи и истории.
    const [, , from, to] = aidMirror.paidWithin.mock.calls[0] as unknown as [string, string, Date, Date];
    expect(from.toISOString()).toBe('2026-10-31T21:00:00.000Z');
    expect(to.toISOString()).toBe('2026-11-30T21:00:00.000Z');
    expect(ledger2History.getHistory).toHaveBeenCalledWith(expect.objectContaining({ coopname: COOP, username: BRANAME, operationCodes: ['o.brn.expfnd', 'o.brn.expunf'], dateFrom: from, dateTo: to }));
  });

  it('служебные записки: выделено минус возвращено, записки по плану не удваивают планы, ниже нуля не бывает', async () => {
    const { service } = build({
      plans: [{ id: 2, branchName: BRANAME, title: 'Транспорт', amount: '50000.0000 RUB', dueDate: inNov, proposalHash: 'P1', paidAt: inNov }],
      history: [
        { globalSequence: '1', action: 'apply', operationCode: 'o.brn.expfnd', processHash: 'p1', quantity: '50000.0000 RUB' },
        { globalSequence: '2', action: 'apply', operationCode: 'o.brn.expfnd', processHash: 'm1', quantity: '70000.0000 RUB' },
        { globalSequence: '3', action: 'apply', operationCode: 'o.brn.expunf', processHash: 'm1', quantity: '20000.0000 RUB' },
      ],
    });
    const facts = await service.collectFacts(COOP, BRANAME, NOVEMBER);
    expect(facts.memos).toBe(toUnits('50000.0000'));
    expect(facts.planned).toBe(toUnits('50000.0000'));

    const onlyRefund = build({ history: [{ globalSequence: '1', action: 'apply', operationCode: 'o.brn.expunf', processHash: 'x', quantity: '10.0000 RUB' }] });
    expect((await onlyRefund.service.collectFacts(COOP, BRANAME, NOVEMBER)).memos).toBe(0n);
  });

  it('материальная помощь берётся из зеркала заявлений за месяц', async () => {
    const { service } = build({ aidPaid: '250000.0000' });
    expect((await service.collectFacts(COOP, BRANAME, NOVEMBER)).aidPaid).toBe(toUnits('250000.0000'));
  });
});

describe('mkt.order.keu.11 — расчёт контрактом и зеркало', () => {
  it('ensureClosed передаёт пять фактов активами, читает строку цепи и зеркалирует её с числом строк прогона', async () => {
    const { service, chainPort, store } = build({
      plans: [{ id: 1, branchName: BRANAME, title: 'Аренда', amount: '200000.0000 RUB', dueDate: new Date('2026-11-15T10:00:00.000Z'), proposalHash: null, paidAt: null }],
      history: [{ globalSequence: '2', action: 'apply', operationCode: 'o.brn.expfnd', processHash: 'm1', quantity: '50000.0000 RUB' }],
      aidPaid: '250000.0000',
    });
    const row = await service.ensureClosed(COOP, BRANAME, NOVEMBER, toUnits('3000000.0000'), toUnits('1140000.0000'), 2);
    expect(chainPort.closePeriod).toHaveBeenCalledWith({
      coopname: COOP, braname: BRANAME, period: NOVEMBER,
      turnover: '3000000.0000 RUB', secured: '1140000.0000 RUB',
      planned: '200000.0000 RUB', memos: '50000.0000 RUB', aid_paid: '250000.0000 RUB',
    });
    expect(row).toMatchObject({
      braname: BRANAME, period: NOVEMBER, membership: '632911.3924', funds_amount: '132911.3924', branch_amount: '500000.0000',
      initiator_amount: '313380.7594', return_amount: '193707.8482', rate_branch: '166666', rate_funds: '44303', rate_initiator: '104460',
      initiator: 'chairkrg', rows_total: 2, rows_charged: 0, deleted_at: null,
    });
    expect(row.closed_at.toISOString()).toBe('2026-12-01T00:15:00.000Z');
    expect(store.rows.size).toBe(1);
  });

  it('повтор в том же месяце: зеркало есть — контракт не зовётся', async () => {
    const { service, chainPort } = build();
    await service.ensureClosed(COOP, BRANAME, NOVEMBER, 1n, 1n, 1);
    await service.ensureClosed(COOP, BRANAME, NOVEMBER, 1n, 1n, 1);
    expect(chainPort.closePeriod).toHaveBeenCalledTimes(1);
  });

  it('контракт отвечает MARKETPLACE_PERIOD_EXISTS — строка читается из цепи и зеркалируется; другой отказ — наверх', async () => {
    const tolerant = build({ closeError: new Error('MARKETPLACE_PERIOD_EXISTS: Итог участка за период уже рассчитан') });
    const row = await tolerant.service.ensureClosed(COOP, BRANAME, NOVEMBER, 1n, 1n, 3);
    expect(row.membership).toBe('632911.3924');

    const failing = build({ closeError: new Error('MARKETPLACE_PERIOD_AMOUNT_INVALID: ноль') });
    await expect(failing.service.ensureClosed(COOP, BRANAME, NOVEMBER, 1n, 1n, 3)).rejects.toThrow(/MARKETPLACE_PERIOD_AMOUNT_INVALID/);
  });

  it('строки в цепи нет после расчёта — ошибка с именем участка и периода', async () => {
    const { service } = build({ chainRows: [] });
    await expect(service.ensureClosed(COOP, BRANAME, NOVEMBER, 1n, 1n, 1)).rejects.toThrow(/krg.*24323/);
  });

  it('noteCharged увеличивает число списанных строк', async () => {
    const { service, store } = build();
    await service.ensureClosed(COOP, BRANAME, NOVEMBER, 1n, 1n, 2);
    await service.noteCharged(COOP, BRANAME, NOVEMBER, 1);
    await service.noteCharged(COOP, BRANAME, NOVEMBER, 1);
    expect(store.rows.get(`${COOP}/${BRANAME}/${NOVEMBER}`)?.rows_charged).toBe(2);
  });
});

describe('mkt.order.keu.11 — стирание старых строк и чтение', () => {
  it('pruneOld стирает из цепи строки старше прошлого месяца и отмечает их; текущий и прошлый остаются', async () => {
    const { service, chainPort, store } = build();
    for (const period of [NOVEMBER - 3, NOVEMBER - 2, NOVEMBER - 1]) {
      await store.insert({ coopname: COOP, braname: BRANAME, period, deleted_at: null, rows_total: 1, rows_charged: 1 });
    }
    await service.pruneOld(COOP, BRANAME, NOVEMBER);
    expect(chainPort.deletePeriod.mock.calls.map((c: any[]) => c[0].period).sort()).toEqual([NOVEMBER - 3, NOVEMBER - 2]);
    expect(store.rows.get(`${COOP}/${BRANAME}/${NOVEMBER - 3}`)?.deleted_at).not.toBeNull();
    expect(store.rows.get(`${COOP}/${BRANAME}/${NOVEMBER - 1}`)?.deleted_at).toBeNull();
  });

  it('строки в цепи уже нет — отметка ставится; другой отказ — строка остаётся не стёртой', async () => {
    const gone = build({ deleteError: new Error('MARKETPLACE_PERIOD_NOT_CLOSED: нет') });
    await gone.store.insert({ coopname: COOP, braname: BRANAME, period: NOVEMBER - 5, deleted_at: null, rows_total: 1, rows_charged: 1 });
    await gone.service.pruneOld(COOP, BRANAME, NOVEMBER);
    expect(gone.store.rows.get(`${COOP}/${BRANAME}/${NOVEMBER - 5}`)?.deleted_at).not.toBeNull();

    const broken = build({ deleteError: new Error('сеть') });
    await broken.store.insert({ coopname: COOP, braname: BRANAME, period: NOVEMBER - 5, deleted_at: null, rows_total: 1, rows_charged: 1 });
    await broken.service.pruneOld(COOP, BRANAME, NOVEMBER);
    expect(broken.store.rows.get(`${COOP}/${BRANAME}/${NOVEMBER - 5}`)?.deleted_at).toBeNull();
    expect(broken.logger.warn).toHaveBeenCalled();
  });

  it('listForBranch — новые месяцы первыми, страницами', async () => {
    const { service, store } = build();
    for (const period of [NOVEMBER - 2, NOVEMBER, NOVEMBER - 1]) {
      await store.insert({ coopname: COOP, braname: BRANAME, period, deleted_at: null, rows_total: 1, rows_charged: 1 });
    }
    const page = await service.listForBranch(COOP, BRANAME, { page: 1, limit: 2 } as never);
    expect(page.items.map((r) => r.period)).toEqual([NOVEMBER, NOVEMBER - 1]);
    expect(page.totalCount).toBe(3);
    expect(page.totalPages).toBe(2);
  });

  it('ratePercentOf: сумма трёх ставок в процентах с двумя знаками, округление половины вверх', () => {
    const { service } = build();
    expect(service.ratePercentOf({ rate_branch: '166666', rate_funds: '44303', rate_initiator: '104460' })).toBe('31.54');
    expect(service.ratePercentOf({ rate_branch: '300200', rate_funds: '79800', rate_initiator: '0' })).toBe('38.00');
    expect(service.ratePercentOf({ rate_branch: '0', rate_funds: '0', rate_initiator: '0' })).toBe('0.00');
  });
});
