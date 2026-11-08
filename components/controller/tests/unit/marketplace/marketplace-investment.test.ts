/**
 * Инвестиционный этап кооперативного участка — ИСТОК (задача 99D-30):
 * предпросмотр доступного возврата повторяет формулу контракта (эталон
 * PeriodModel.crpsClaimable) и прибавляет прежние начисления на кошельке
 * паевые взносы; фазы участка; правило «вносит оператор участка» до цепи;
 * документы требуют договора участия. Реестр: mkt.order.invest.istok.*.
 */
jest.mock('@coopenomics/extension-kit', () => {
  const actual = jest.requireActual('@coopenomics/extension-kit');
  return {
    ...actual,
    platformSettings: () => ({ coopname: 'voskhod', timezone: 'Europe/Moscow', frontendUrl: 'https://coop.test' }),
  };
});

import { MarketContract } from 'cooptypes';
import {
  MarketplaceInvestHistoryKind,
  MarketplaceInvestPhase,
  MarketplaceInvestmentService,
} from '~/extensions/marketplace/application/services/marketplace-investment.service';
import { MarketplaceInvestmentNotificationListener } from '~/extensions/marketplace/application/listeners/marketplace-investment-notification.listener';

const COOP = 'voskhod';
const S = MarketContract.PeriodModel.CRPS_SCALE;

function toUnits(value: string): bigint {
  const [int = '0', frac = ''] = (String(value).trim().split(/\s+/)[0] ?? '0').split('.');
  return BigInt(int) * 10_000n + BigInt((frac + '0000').slice(0, 4));
}
function toAsset(units: bigint): string {
  const padded = units.toString().padStart(5, '0');
  return `${padded.slice(0, -4)}.${padded.slice(-4)} RUB`;
}
const rub = (n: number) => BigInt(n) * 10_000n;

/** Строка участка, где два инициатора: имущество 600 000 и 400 000 ₽, возмещено 100 000 ₽. */
function world(opts: { operator?: boolean; walletExtra?: bigint; agreement?: boolean; repaid?: bigint } = {}) {
  const base = rub(1_000_000);
  const repaid = opts.repaid ?? rub(100_000);
  const acc = (repaid * S) / base;
  const branch = {
    braname: 'krg',
    money_total: toAsset(0n),
    property_total: toAsset(base),
    unused_total: toAsset(0n),
    reserved: toAsset(0n),
    spent_total: toAsset(0n),
    repaid_total: toAsset(repaid),
    surplus_total: toAsset(0n),
    base: String(base),
    acc: String(acc),
    s_join: '0',
    s_fixed: '0',
    join_seq: 2,
  };
  const investors = [
    { id: 1, braname: 'krg', username: 'anna', status: 'active', money: toAsset(0n), property: toAsset(rub(600_000)), used_money: toAsset(0n), claimed: toAsset(0n), returned_fixed: '0', acc_join: '0', acc_done: '0', join_seq: 1, joined_at: '2026-11-07T00:00:00' },
    { id: 2, braname: 'krg', username: 'boris', status: 'active', money: toAsset(0n), property: toAsset(rub(400_000)), used_money: toAsset(0n), claimed: toAsset(0n), returned_fixed: '0', acc_join: '0', acc_done: '0', join_seq: 2, joined_at: '2026-11-07T00:00:00' },
  ];
  const chainPort = {
    getInvestBranch: jest.fn(async () => branch),
    listBranchInvestors: jest.fn(async () => investors),
    listUserInvestments: jest.fn(async (_c: string, u: string) => investors.filter((i) => i.username === u)),
    listBranchInvestProperties: jest.fn(async () => []),
    getUserWallet: jest.fn(async (_c: string, _w: string, u: string) => {
      const inv = investors.find((i) => i.username === u)!;
      return { available: toAsset(toUnits(inv.property) + (opts.walletExtra ?? 0n)) };
    }),
    getInvestAgreement: jest.fn(async () => (opts.agreement === false ? null : { username: 'anna', signed_at: '2026-11-07T10:00:00' })),
    investMoney: jest.fn(async () => ({})),
  };
  const economyService = { assetToUnits: toUnits, unitsToAsset: toAsset };
  const documentPort = { generate: jest.fn(async (input: any) => ({ full_title: '', html: '', hash: 'h', meta: input.data, binary: '' })) };
  const kuChairman = { isMemberOfBranch: jest.fn(async () => opts.operator !== false), getTrusteeOfBranch: jest.fn(async () => 'chair') };
  const accountPort = { getDisplayName: jest.fn(async (n: string) => n.toUpperCase()) };
  const logger = { setContext: jest.fn(), log: jest.fn(), warn: jest.fn() };
  const ledger2History = {
    getHistory: jest.fn(async () => ({
      items: [
        { globalSequence: '11', blockNum: 1, coopname: COOP, action: 'apply', operationCode: 'o.mkt.inv', processHash: 'AB'.repeat(32), username: 'anna', quantity: '5000.0000 RUB', createdAt: new Date('2026-11-07T10:00:00Z') },
        { globalSequence: '10', blockNum: 1, coopname: COOP, action: 'apply', operationCode: 'o.mkt.iprop', processHash: 'cd'.repeat(32), username: 'anna', quantity: '600000.0000 RUB', createdAt: new Date('2026-11-06T10:00:00Z') },
        { globalSequence: '9', blockNum: 1, coopname: COOP, action: 'apply', operationCode: 'o.mkt.repay', processHash: 'ef'.repeat(32), username: 'anna', quantity: '1.0000 RUB', createdAt: new Date('2026-11-05T10:00:00Z') },
      ],
      totalCount: 3,
      totalPages: 1,
      currentPage: 1,
    })),
  };
  const service = new MarketplaceInvestmentService(
    chainPort as any,
    documentPort as any,
    economyService as any,
    kuChairman as any,
    accountPort as any,
    logger as any,
    null,
    ledger2History as any
  );
  return { service, chainPort, documentPort, ledger2History };
}

describe('mkt.order.invest.istok — паевые взносы инициаторов в ИСТОКЕ', () => {
  it('istok.01 — предпросмотр возврата 60 / 40 % совпадает с эталоном контракта до копейки', async () => {
    const { service } = world();
    const anna = await service.previewClaim(COOP, 'krg', 'anna');
    const boris = await service.previewClaim(COOP, 'krg', 'boris');
    // Эталон контракта на тех же строках — совпадение до единицы актива.
    const model = MarketContract.PeriodModel;
    expect(anna).toBe(rub(60_000));
    expect(boris).toBe(rub(40_000));
    expect(model.crpsReturned({ active: true, money: 0n, property: rub(600_000), usedMoney: 0n, claimed: 0n, returnedFixed: 0n, accJoin: 0n }, (rub(100_000) * S) / rub(1_000_000))).toBe(anna);
  });

  it('istok.02 — прежние начисления на кошельке договора участия сверх строк прибавляются к доступному', async () => {
    const { service } = world({ walletExtra: rub(5_000) });
    const anna = await service.previewClaim(COOP, 'krg', 'anna');
    expect(anna).toBe(rub(65_000));
  });

  it('istok.03 — фаза: паевые взносы есть, возмещения нет — FUNDING; возмещение идёт — RETURNING', async () => {
    expect((await world({ repaid: 0n }).service.getBranchInvestment(COOP, 'krg')).phase).toBe(MarketplaceInvestPhase.FUNDING);
    const view = await world().service.getBranchInvestment(COOP, 'krg');
    expect(view.phase).toBe(MarketplaceInvestPhase.RETURNING);
    expect(view.investors).toHaveLength(2);
    expect(view.outstanding).toBe(rub(900_000));
  });

  it('istok.03b — фаза: без строки участка — NONE; база погашена, возмещение было — RETURNED', async () => {
    const empty = world();
    empty.chainPort.getInvestBranch.mockResolvedValueOnce(null as any);
    const none = await empty.service.getBranchInvestment(COOP, 'krg');
    expect(none.phase).toBe(MarketplaceInvestPhase.NONE);
    expect(none.outstanding).toBe(0n);
    expect(none.investors).toEqual([]);

    const done = world();
    const branch = await done.chainPort.getInvestBranch();
    done.chainPort.getInvestBranch.mockResolvedValue({ ...branch, base: '0', acc: '0' });
    expect((await done.service.getBranchInvestment(COOP, 'krg')).phase).toBe(MarketplaceInvestPhase.RETURNED);
  });

  it('istok.04 — вносит только оператор участка: отказ до цепи с кодом', async () => {
    const { service, chainPort } = world({ operator: false });
    await expect(service.investMoney(COOP, 'ekaterina', 'krg', 'hash', 100, {} as any)).rejects.toMatchObject({ code: 'MARKETPLACE_INVEST_NOT_OPERATOR' });
    expect(chainPort.investMoney).not.toHaveBeenCalled();
  });

  it('istok.05 — заявление о паевом взносе без договора участия не формируется', async () => {
    const { service, documentPort } = world({ agreement: false });
    await expect(service.generateInvestStatement(COOP, 'anna', 'krg', 1000)).rejects.toMatchObject({ code: 'MARKETPLACE_INVAGR_REQUIRED' });
    expect(documentPort.generate).not.toHaveBeenCalled();
  });

  it('istok.06 — заявление о паевом взносе: номер договора, участок и сумма в данных документа', async () => {
    const { service, documentPort } = world();
    await service.generateInvestStatement(COOP, 'anna', 'krg', 300_000);
    const data = documentPort.generate.mock.calls[0][0].data;
    expect(data.registry_id).toBe(1119);
    expect(data.agreement_number).toBe(service.agreementNumber(COOP, 'anna'));
    expect(data.branch_name).toBe('KRG');
    expect(data.amount).toBe('300000.0000 RUB');
  });

  it('istok.08 — проход списания возместил паевые взносы: инициаторам с доступной суммой — уведомление со ссылкой на страницу, без суммы — нет', async () => {
    const w = world();
    w.chainPort.listUserInvestments.mockImplementation(async (_c: string, u: string) =>
      u === 'boris' ? [] : [{ braname: 'krg', username: u, status: 'active', money: toAsset(0n), property: toAsset(rub(600_000)), used_money: toAsset(0n), claimed: toAsset(0n), returned_fixed: '0', acc_join: '0' } as any]
    );
    const notifications = { notifyUser: jest.fn(async () => undefined) };
    const listener = new MarketplaceInvestmentNotificationListener(
      w.chainPort as any,
      notifications as any,
      { getDisplayName: jest.fn(async (n: string) => n.toUpperCase()) } as any,
      {} as any,
      w.service,
      { unitsToAsset: toAsset } as any,
      { setContext: jest.fn(), warn: jest.fn() } as any
    );
    await listener.onRepaid({ coopname: COOP, branames: ['krg'] });
    expect(notifications.notifyUser).toHaveBeenCalledTimes(1);
    const [username, workflowId, payload] = (notifications.notifyUser.mock.calls[0] as unknown) as [string, string, any];
    expect(username).toBe('anna');
    expect(workflowId).toBe('vlozhenie-vozmeshcheno');
    expect(payload.branchName).toBe('KRG');
    expect(payload.deepLinkUrl).toBe('https://coop.test/voskhod/market-pvz/initiators');
  });

  it('istok.09 — история паевых взносов: деньги и имущество по операциям учёта пайщика, хэш процесса в нижнем регистре, чужие операции отброшены', async () => {
    const { service, ledger2History } = world();
    const page = await service.listMyHistory(COOP, 'anna', { page: 1, limit: 20 } as any);
    expect(ledger2History.getHistory).toHaveBeenCalledWith(
      expect.objectContaining({ username: 'anna', actionNames: ['apply'], operationCodes: ['o.mkt.inv', 'o.mkt.iprop', 'o.mkt.iback', 'o.mkt.iexit'] })
    );
    expect(page.items.map((i) => i.kind)).toEqual([MarketplaceInvestHistoryKind.MONEY, MarketplaceInvestHistoryKind.PROPERTY]);
    expect(page.items[0].amount).toBe(rub(5_000));
    expect(page.items[0].process_hash).toBe('ab'.repeat(32));
  });

  it('istok.10 — вторая подпись акта ложится на акт вносящего: подписи соединяются; чужой акт отклоняется до цепи', async () => {
    const { service, chainPort } = world();
    const sig = (id: number, signer: string) => ({ id, signed_hash: 'S', signer, public_key: 'PUB', signature: 'SIG', signed_at: '2026-11-07T10:00:00', meta: '' });
    const act1 = { version: '1', hash: 'H1', doc_hash: 'D1', meta_hash: 'M1', meta: '{}', signatures: [sig(1, 'anna')] };
    Object.assign(chainPort, {
      getInvestProperty: jest.fn(async () => ({ hash: 'ab', braname: 'krg', username: 'anna', status: 'act1', act: act1 })),
      signInvestPropertyAct2: jest.fn(async () => ({})),
    });
    const chairman = { version: '1', hash: 'H1', doc_hash: 'D1', meta_hash: 'M1', meta: {}, signatures: [sig(2, 'chair')] };
    await service.signPropertyAct(COOP, 'chair', 'ab', chairman as any, true);
    const sent = (chainPort as any).signInvestPropertyAct2.mock.calls[0][0];
    expect(sent.act.signatures.map((s: any) => s.signer)).toEqual(['anna', 'chair']);
    expect(sent.act.hash).toBe('H1');

    await expect(service.signPropertyAct(COOP, 'chair', 'ab', { ...chairman, hash: 'OTHER' } as any, true)).rejects.toMatchObject({
      code: 'MARKETPLACE_IPROP_ACT_MISMATCH',
    });
  });

  // Робот исполняет решение совета и стирает его строку в soviet::decisions;
  // акт после этого всё равно формируется — номер решения берётся из протокола
  // 1121 в заявлении. Без протокола и без строки совета акта нет.
  it('istok.11 — акт приёма имущества после исполненного решения: номер решения из протокола в заявлении; без решения — отказ с кодом', async () => {
    const { service, chainPort, documentPort } = world();
    const prop = { hash: 'ab', braname: 'krg', username: 'anna', status: 'authorized', amount: '600000.0000 RUB', statement: { meta: '{}' }, decision: { meta: JSON.stringify({ decision_id: 42 }) }, act: null };
    Object.assign(chainPort, {
      getInvestProperty: jest.fn(async () => prop),
      findCouncilDecisionByHash: jest.fn(async () => null),
    });
    await service.generatePropertyAct(COOP, 'ab');
    expect(documentPort.generate.mock.calls[0][0].data.decision_id).toBe(42);

    (chainPort as any).getInvestProperty.mockResolvedValue({ ...prop, status: 'created', decision: { meta: '' } });
    await expect(service.generatePropertyAct(COOP, 'ab')).rejects.toMatchObject({ code: 'MARKETPLACE_IPROP_DECISION_MISSING' });
  });
});
