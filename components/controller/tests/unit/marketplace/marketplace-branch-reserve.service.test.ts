/**
 * Резерв социально-экономического обеспечения пайщиков и настройки модели
 * (задача 99D-22): чтение настроек, доля инициатора, потолок, строки резерва с
 * остатком на месяц, предварительная проверка предела материальной помощи.
 * Реестр: mkt.order.keu.10.
 */
jest.mock('@coopenomics/extension-kit', () => {
  const actual = jest.requireActual('@coopenomics/extension-kit');
  return {
    ...actual,
    platformSettings: () => ({ coopname: 'voskhod', timezone: 'Europe/Moscow', frontendUrl: 'https://coop.test' }),
  };
});

import { MarketplaceBranchReserveService } from '~/extensions/marketplace/application/services/marketplace-branch-reserve.service';

const COOP = 'voskhod';

function toUnits(value: string): bigint {
  const [int = '0', frac = ''] = (String(value).trim().split(/\s+/)[0] ?? '0').split('.');
  return BigInt(int) * 10_000n + BigInt((frac + '0000').slice(0, 4));
}
function toAsset(units: bigint): string {
  const padded = units.toString().padStart(5, '0');
  return `${padded.slice(0, -4)}.${padded.slice(-4)} RUB`;
}

function build(opts: {
  limit?: string | null;
  reserves?: Array<{ braname: string; username: string; amount: string }>;
  initiators?: Array<{ braname: string; username: string }>;
  config?: { membership_fee_percent: number; initiator_share_percent?: number } | null;
  submitted?: Record<string, string>;
  trusted?: string[];
} = {}) {
  const chainPort = {
    getEconomyConfig: jest.fn(async () => opts.config === undefined ? { membership_fee_percent: 380_000 } : opts.config),
    getBranchConfig: jest.fn(async () => (opts.limit === null ? null : { aid_month_limit: opts.limit ?? '200000.0000 RUB' })),
    // Реестр фондов `funds` (задача 99D-25): у каждого фонда накопления свой кошелёк ledger2.
    listAccumulationFunds: jest.fn(async () => [
      { id: 1, kind: 'accum', name: 'Неделимый фонд', percent: 10_000, wallet: 'w.fnd.indiv' },
      { id: 2, kind: 'accum', name: 'Резервный фонд', percent: 150_000, wallet: 'w.fnd.resrv' },
      { id: 3, kind: 'accum', name: 'Фонд развития', percent: 50_000, wallet: 'w.fnd.devel' },
    ]),
    listReserves: jest.fn(async () => (opts.reserves ?? []).map((r, i) => ({ id: i + 1, ...r }))),
    listInitiators: jest.fn(async () => opts.initiators ?? []),
    listBranchWalletBalances: jest.fn(async () => [
      { username: 'investor', wallet_name: 'w.mkt.invest', available: '31447.5900 RUB' },
      { username: 'chairkrg', wallet_name: 'w.brn.person', available: '5.0000 RUB' },
    ]),
    setShares: jest.fn(async () => ({})),
    setAidLimit: jest.fn(async () => ({})),
    setInitiator: jest.fn(async () => ({})),
    setReserve: jest.fn(async () => ({})),
    deleteReserve: jest.fn(async () => ({})),
  };
  const economy = {
    assetToUnits: (v: string) => toUnits(v),
    unitsToAsset: (u: bigint) => toAsset(u),
    getMembershipFeePercent: jest.fn(async () => 38),
  };
  const kuChairman = {
    isMemberOfBranch: jest.fn(async (_c: string, _b: string, u: string) => (opts.trusted ?? ['chairkrg', 'oper1']).includes(u)),
    getTrusteeOfBranch: jest.fn(async () => 'chairkrg'),
  };
  const aidMirror = {
    submittedWithin: jest.fn(async (_c: string, username: string) => toUnits(opts.submitted?.[username] ?? '0')),
  };
  const service = new MarketplaceBranchReserveService(chainPort as never, economy as never, kuChairman as never, aidMirror as never);
  return { service, chainPort, aidMirror };
}

describe('mkt.order.keu.10 — настройки экономики для администратора', () => {
  it('ставка, доля инициатора, потолок и проценты фондов — в человеческих единицах', async () => {
    const { service } = build({ config: { membership_fee_percent: 380_000, initiator_share_percent: 618_000 } });
    expect(await service.getSettings(COOP)).toEqual({
      membership_fee_percent: 38,
      initiator_share_percent: 61.8,
      aid_month_limit: '200000.0000 RUB',
      funds_percent: 21,
      funds: [
        { name: 'Неделимый фонд', percent: 1, wallet_name: 'w.fnd.indiv' },
        { name: 'Резервный фонд', percent: 15, wallet_name: 'w.fnd.resrv' },
        { name: 'Фонд развития', percent: 5, wallet_name: 'w.fnd.devel' },
      ],
    });
  });

  it('без настроек доля инициатора — 61,8 % по умолчанию, потолок — ноль', async () => {
    const { service } = build({ config: null, limit: null });
    const s = await service.getSettings(COOP);
    expect(s.initiator_share_percent).toBe(61.8);
    expect(s.aid_month_limit).toBe('0.0000 RUB');
  });

  it('setInitiatorShare переводит проценты в шкалу контракта; вне 0–100 — отказ', async () => {
    const { service, chainPort } = build();
    expect(await service.setInitiatorShare(COOP, 50)).toBe(50);
    expect(chainPort.setShares).toHaveBeenCalledWith({ coopname: COOP, initiator_share_percent: 500_000 });
    await expect(service.setInitiatorShare(COOP, 101)).rejects.toMatchObject({ code: 'MARKETPLACE_ECONOMY_PERCENT_OUT_OF_RANGE' });
  });

  it('setAidLimit пишет потолок активом; отрицательный — отказ', async () => {
    const { service, chainPort } = build();
    expect(await service.setAidLimit(COOP, 150000)).toBe('150000.0000 RUB');
    expect(chainPort.setAidLimit).toHaveBeenCalledWith({ coopname: COOP, limit: '150000.0000 RUB' });
    await expect(service.setAidLimit(COOP, -1)).rejects.toMatchObject({ code: 'MARKETPLACE_AID_LIMIT_INVALID' });
  });

  it('инициатор участка: назначенный, иначе председатель; снятие — пустым именем', async () => {
    const assigned = build({ initiators: [{ braname: 'krg', username: 'investor' }] });
    expect(await assigned.service.getBranchInitiator(COOP, 'krg')).toEqual({ username: 'investor', assigned: true, invest_balance: '31447.5900 RUB' });
    const byChair = build();
    expect(await byChair.service.getBranchInitiator(COOP, 'krg')).toEqual({ username: 'chairkrg', assigned: false, invest_balance: '0.0000 RUB' });
    await byChair.service.setBranchInitiator(COOP, 'krg', null);
    expect(byChair.chainPort.setInitiator).toHaveBeenCalledWith({ coopname: COOP, braname: 'krg', username: '' });
  });
});

describe('mkt.order.keu.10 — резерв участка', () => {
  it('строки с остатком на месяц: резерв минус поданное; чужой участок не входит', async () => {
    const { service } = build({
      reserves: [
        { braname: 'krg', username: 'chairkrg', amount: '200000.0000 RUB' },
        { braname: 'krg', username: 'oper1', amount: '100000.0000 RUB' },
        { braname: 'msk', username: 'other', amount: '50000.0000 RUB' },
      ],
      submitted: { oper1: '60000.0000' },
    });
    const view = await service.getReserves(COOP, 'krg', new Date('2026-11-10T10:00:00.000Z'));
    expect(view.limit).toBe('200000.0000 RUB');
    expect(view.rows).toEqual([
      { username: 'chairkrg', amount: '200000.0000 RUB', submitted: '0.0000 RUB', remaining: '200000.0000 RUB' },
      { username: 'oper1', amount: '100000.0000 RUB', submitted: '60000.0000 RUB', remaining: '40000.0000 RUB' },
    ]);
  });

  it('setReserve: получатель вне участка — отказ до цепи; сумма ноль — отказ; иначе действие с активом', async () => {
    const { service, chainPort } = build();
    await expect(service.setReserve(COOP, 'krg', 'stranger', 1000)).rejects.toMatchObject({ code: 'MARKETPLACE_RESERVE_RECIPIENT_NOT_TRUSTED' });
    await expect(service.setReserve(COOP, 'krg', 'oper1', 0)).rejects.toMatchObject({ code: 'MARKETPLACE_RESERVE_AMOUNT_INVALID' });
    await service.setReserve(COOP, 'krg', 'oper1', 100000);
    expect(chainPort.setReserve).toHaveBeenCalledWith({ coopname: COOP, braname: 'krg', username: 'oper1', amount: '100000.0000 RUB' });
  });

  it('deleteReserve зовёт контракт', async () => {
    const { service, chainPort } = build();
    await service.deleteReserve(COOP, 'krg', 'oper1');
    expect(chainPort.deleteReserve).toHaveBeenCalledWith({ coopname: COOP, braname: 'krg', username: 'oper1' });
  });
});

describe('mkt.order.keu.10 — предел материальной помощи до обращения в цепь', () => {
  const now = new Date('2026-11-10T10:00:00.000Z');

  it('потолок ноль — предела нет', async () => {
    const { service, aidMirror } = build({ limit: '0.0000 RUB' });
    await expect(service.assertAidWithinReserve(COOP, 'krg', 'oper1', 999999, now)).resolves.toBeUndefined();
    expect(aidMirror.submittedWithin).not.toHaveBeenCalled();
  });

  it('без строки резерва — MARKETPLACE_AID_NO_RESERVE', async () => {
    const { service } = build({ reserves: [] });
    await expect(service.assertAidWithinReserve(COOP, 'krg', 'oper1', 10, now)).rejects.toMatchObject({ code: 'MARKETPLACE_AID_NO_RESERVE' });
  });

  it('в пределах резерва проходит; сверх — MARKETPLACE_AID_OVER_RESERVE с суммами', async () => {
    const { service } = build({ reserves: [{ braname: 'krg', username: 'oper1', amount: '100000.0000 RUB' }], submitted: { oper1: '60000.0000' } });
    await expect(service.assertAidWithinReserve(COOP, 'krg', 'oper1', 40000, now)).resolves.toBeUndefined();
    await expect(service.assertAidWithinReserve(COOP, 'krg', 'oper1', 40000.01, now)).rejects.toMatchObject({
      code: 'MARKETPLACE_AID_OVER_RESERVE',
      params: { requested: '40000.0100 RUB', submitted: '60000.0000 RUB', reserve: '100000.0000 RUB' },
    });
  });

  it('поданное считается за месяц по часовому поясу кооператива', async () => {
    const { service, aidMirror } = build({ reserves: [{ braname: 'krg', username: 'oper1', amount: '100000.0000 RUB' }] });
    await service.assertAidWithinReserve(COOP, 'krg', 'oper1', 1, new Date('2026-10-31T21:30:00.000Z')); // 1 ноября 00:30 по Москве
    const [, , from, to] = aidMirror.submittedWithin.mock.calls[0] as unknown as [string, string, Date, Date];
    expect(from.toISOString()).toBe('2026-10-31T21:00:00.000Z');
    expect(to.toISOString()).toBe('2026-11-30T21:00:00.000Z');
  });
});
