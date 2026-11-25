/**
 * Зеркало заявлений на материальную помощь участка (задача 99D-22): строки
 * заводятся и переводятся по действиям контракта branch, сумма выплаченной
 * помощи участка за месяц и поданной получателем — для итога месяца и предела
 * по резерву. Реестр: mkt.order.keu.09.
 */
import {
  MarketplaceBranchAidMirrorService,
} from '~/extensions/marketplace/application/services/marketplace-branch-aid-mirror.service';
import { MarketplaceBranchAidStatus } from '~/extensions/marketplace/infrastructure/entities/marketplace-branch-aid.entity';
import { matches } from './helpers/memory-table';

const COOP = 'voskhod';
const HASH = 'a'.repeat(64);

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
  return {
    rows,
    findOne: jest.fn(async (where: any) => [...rows.values()].find((r) => matches(r, where)) ?? null),
    find: jest.fn(async (where: any) => [...rows.values()].filter((r) => matches(r, where))),
    insert: jest.fn(async (fields: any) => {
      rows.set(fields.aid_hash, { updated_at: new Date(), ...fields });
      return rows.get(fields.aid_hash);
    }),
    update: jest.fn(async (where: any, patch: any) => {
      const row = rows.get(where.aid_hash);
      if (!row) return 0;
      rows.set(where.aid_hash, { ...row, ...patch });
      return 1;
    }),
  };
}

function build() {
  const store = memoryStore();
  const economy = { assetToUnits: (v: string) => toUnits(v), unitsToAsset: (u: bigint) => toAsset(u) };
  const logger = { setContext: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn(), log: jest.fn(), debug: jest.fn() };
  const service = new MarketplaceBranchAidMirrorService(store as never, economy as never, logger as never);
  return { service, store, logger };
}

function action(name: string, data: Record<string, unknown>, blockTime = '2026-10-10T10:00:00.000Z', seq = 1) {
  return {
    transaction_id: 't', account: 'branch', block_num: seq, block_id: 'b', block_time: blockTime, chain_id: 'c',
    name, receiver: 'branch', authorization: [], action_ordinal: 1, global_sequence: String(seq), account_ram_deltas: [], data,
  } as never;
}

const createData = (over: Record<string, unknown> = {}) => ({
  coopname: COOP, username: 'oper1', braname: 'krg', aid_hash: HASH.toUpperCase(), amount: '60000.0000 RUB', statement: {}, meta: '{}', ...over,
});

describe('mkt.order.keu.09 — зеркало заявлений: создание и переходы', () => {
  it('createaid заводит строку «подано» с участком, получателем и суммой целиком; хэш в нижнем регистре', async () => {
    const { service, store } = build();
    await service.onCreateAid(action('createaid', createData()));
    expect(store.rows.get(HASH)).toMatchObject({ braname: 'krg', username: 'oper1', amount: '60000.0000', status: MarketplaceBranchAidStatus.PROPOSED, paid_at: null });
  });

  it('повтор createaid строку не трогает', async () => {
    const { service, store } = build();
    await service.onCreateAid(action('createaid', createData()));
    await service.onCreateAid(action('createaid', createData({ amount: '1.0000 RUB' })));
    expect(store.rows.get(HASH)?.amount).toBe('60000.0000');
    expect(store.insert).toHaveBeenCalledTimes(1);
  });

  it('onaidauth → одобрено; aidconfirm → выплачено с моментом блока; дальше состояние не меняется', async () => {
    const { service, store } = build();
    await service.onCreateAid(action('createaid', createData()));
    await service.onAidAuth(action('onaidauth', { coopname: COOP, hash: HASH, authorization: {} }));
    expect(store.rows.get(HASH)?.status).toBe(MarketplaceBranchAidStatus.APPROVED);
    await service.onAidConfirm(action('aidconfirm', { coopname: COOP, outcome_hash: HASH.toUpperCase() }, '2026-10-20T12:00:00.000Z'));
    expect(store.rows.get(HASH)).toMatchObject({ status: MarketplaceBranchAidStatus.PAID, paid_at: new Date('2026-10-20T12:00:00.000Z') });
    await service.onAidDecl(action('onaiddecl', { coopname: COOP, hash: HASH, reason: 'поздно' }));
    expect(store.rows.get(HASH)?.status).toBe(MarketplaceBranchAidStatus.PAID);
  });

  it('onaiddecl → отклонено; выплатить отклонённое нельзя', async () => {
    const { service, store } = build();
    await service.onCreateAid(action('createaid', createData()));
    await service.onAidDecl(action('onaiddecl', { coopname: COOP, hash: HASH, reason: 'нет' }));
    expect(store.rows.get(HASH)?.status).toBe(MarketplaceBranchAidStatus.DECLINED);
    await service.onAidConfirm(action('aidconfirm', { coopname: COOP, outcome_hash: HASH }));
    expect(store.rows.get(HASH)?.status).toBe(MarketplaceBranchAidStatus.DECLINED);
  });

  it('переход по неизвестному хэшу — предупреждение в журнал, без падения', async () => {
    const { service, logger } = build();
    await service.onAidAuth(action('onaidauth', { coopname: COOP, hash: 'f'.repeat(64), authorization: {} }));
    expect(logger.warn).toHaveBeenCalled();
  });
});

describe('mkt.order.keu.09 — суммы за отрезок времени', () => {
  const from = new Date('2026-10-01T00:00:00.000Z');
  const to = new Date('2026-11-01T00:00:00.000Z');

  async function seed(service: MarketplaceBranchAidMirrorService) {
    const paid = async (hash: string, braname: string, amount: string, paidAt: string, username = 'oper1') => {
      await service.onCreateAid(action('createaid', createData({ aid_hash: hash, braname, amount, username }), '2026-10-05T10:00:00.000Z'));
      await service.onAidConfirm(action('aidconfirm', { coopname: COOP, outcome_hash: hash }, paidAt));
    };
    await paid('1'.repeat(64), 'krg', '150000.0000 RUB', '2026-10-10T10:00:00.000Z');
    await paid('2'.repeat(64), 'krg', '100000.0000 RUB', '2026-10-25T10:00:00.000Z');
    await paid('3'.repeat(64), 'krg', '5000.0000 RUB', '2026-11-02T10:00:00.000Z');
    await paid('4'.repeat(64), 'msk', '7000.0000 RUB', '2026-10-15T10:00:00.000Z');
    await service.onCreateAid(action('createaid', createData({ aid_hash: '5'.repeat(64), braname: 'krg', amount: '20000.0000 RUB' }), '2026-10-28T10:00:00.000Z'));
    await service.onCreateAid(action('createaid', createData({ aid_hash: '6'.repeat(64), braname: 'krg', amount: '30000.0000 RUB' }), '2026-10-29T10:00:00.000Z'));
    await service.onAidDecl(action('onaiddecl', { coopname: COOP, hash: '6'.repeat(64), reason: 'нет' }));
  }

  it('paidWithin: только выплаченное по участку внутри отрезка, конец отрезка не входит', async () => {
    const { service } = build();
    await seed(service);
    expect(await service.paidWithin(COOP, 'krg', from, to)).toBe(toUnits('250000.0000'));
    expect(await service.paidWithin(COOP, 'msk', from, to)).toBe(toUnits('7000.0000'));
  });

  it('submittedWithin: поданные, одобренные и выплаченные занимают предел, отклонённые — нет', async () => {
    const { service } = build();
    await seed(service);
    // 150 000 + 100 000 выплачены, 20 000 подано; 30 000 отклонено не считается; 5 000 подано в октябре,
    // выплачено в ноябре — считается по подаче; 7 000 на другом участке тоже занимает предел получателя:
    // контракт ведёт накопитель месяца по получателю (branch::aidmonths), а не по участку.
    expect(await service.submittedWithin(COOP, 'oper1', from, to)).toBe(toUnits('282000.0000'));
  });
});
