/**
 * Unit-тесты ProcessRegistryService (Epic 4 + Epic 1 addendum + review).
 *
 * Phase A теперь идёт по blockchain_actions (name='apply', cross-account
 * scan). process_type выводится из ACTION_CODE_TO_PROCESS_TYPE[actionCode].
 * Phase B — entity-дельты из PROCESS_HASH_LOCATOR по текущим таблицам/полям
 * (candidates2.registration_hash, results.result_hash, pgproperties.property_hash,
 * requests.hash — не "regs"/"properties"/"request_hash").
 *
 * Покрывают:
 *  (a) одноактовый процесс sov.axncnv — нет entity-таблиц;
 *  (b) мульти-эффектный cap.act2res — 2 apply с action_code cap.act2shr+
 *      cap.act2ln под одним process_hash, оба попадают в actions[], разделить
 *      UI по action.data.action_code;
 *  (c) процесс без документов (wall.deposit) — dep-дельта без signed-полей;
 *  (d) reg.regist с двумя apply (reg.entrfee + reg.minshare) — единый процесс;
 *  (e) миграционный mig.opening — только actions, entity-дельт нет;
 *  (f) валидация hex-64, fail-fast на unknown action_code, 404 без apply-якоря.
 */

import { ProcessRegistryService } from '../../../src/domain/process-registry/services/process-registry.service';
import type { DeltaEntity } from '../../../src/infrastructure/database/typeorm/entities/delta.entity';
import type { ActionEntity } from '../../../src/infrastructure/database/typeorm/entities/action.entity';

type AnyQB = any;

// ---------- helpers ----------

function mockQB(rows: any[]): AnyQB {
  const qb: AnyQB = {
    where: jest.fn(() => qb),
    andWhere: jest.fn(() => qb),
    orderBy: jest.fn(() => qb),
    addOrderBy: jest.fn(() => qb),
    getMany: jest.fn(async () => rows),
  };
  return qb;
}

function makeDelta(partial: Partial<DeltaEntity>): DeltaEntity {
  return {
    id: partial.id ?? 'uuid-delta',
    chain_id: 'chain',
    block_num: (partial.block_num ?? 1) as any,
    block_id: 'bid',
    present: partial.present ?? true,
    code: partial.code ?? 'x',
    scope: partial.scope ?? 'scope',
    table: partial.table ?? 't',
    primary_key: partial.primary_key ?? 'pk',
    value: partial.value ?? {},
    repeat: false,
    created_at: partial.created_at ?? new Date('2026-04-18T00:00:00Z'),
  } as DeltaEntity;
}

function makeAction(partial: Partial<ActionEntity>): ActionEntity {
  return {
    id: partial.id ?? 'uuid-action',
    transaction_id: 'tx',
    account: partial.account ?? 'ledger2',
    block_num: (partial.block_num ?? 1) as any,
    block_id: 'bid',
    chain_id: 'chain',
    name: partial.name ?? 'apply',
    receiver: 'r',
    authorization: [],
    data: partial.data ?? {},
    action_ordinal: 0,
    global_sequence: partial.global_sequence ?? '1',
    account_ram_deltas: [],
    receipt: {} as any,
    creator_action_ordinal: 0,
    context_free: false,
    elapsed: 0,
    repeat: false,
    created_at: partial.created_at ?? new Date('2026-04-18T00:00:00Z'),
  } as ActionEntity;
}

/**
 * Phase A теперь по `actionRepository.createQueryBuilder` — Phase B по
 * `deltaRepository.createQueryBuilder` для каждой HashLocation.
 */
function makeService({
  actions,
  entityDeltasPerLocation,
}: {
  actions: ActionEntity[];
  // Дельты по порядку локаций из PROCESS_HASH_LOCATOR[processType] —
  // порядок определяется конфигом, не тестом. Для одиночной локации (большинство
  // процессов) достаточно одного массива.
  entityDeltasPerLocation: DeltaEntity[][];
}): ProcessRegistryService {
  let deltaCallIdx = 0;
  const deltaRepo: any = {
    createQueryBuilder: jest.fn(() => {
      const rows = entityDeltasPerLocation[deltaCallIdx] ?? [];
      deltaCallIdx += 1;
      return mockQB(rows);
    }),
    manager: { query: jest.fn(async () => [{ cnt: '0' }]) },
  };
  const actionRepo: any = {
    createQueryBuilder: jest.fn(() => mockQB(actions)),
    manager: { query: jest.fn(async () => [{ cnt: '0' }]) },
  };

  const aggregator: any = {
    buildDocumentAggregate: jest.fn(async (signed: any) => ({
      hash: signed.hash ?? signed.doc_hash ?? 'doc-hash',
      document: signed,
      rawDocument: null,
    })),
  };

  const redisClient: any = {
    publisher: { status: 'not-ready', get: jest.fn(), set: jest.fn() },
    subscriber: {},
    streamManager: {},
    streamReader: {},
  };

  const logger: any = {
    setContext: jest.fn(),
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  return new ProcessRegistryService(deltaRepo, actionRepo, aggregator, redisClient, logger);
}

// ---------- тесты ----------

const HASH = 'a'.repeat(64);
const COOP = 'voskhod';

describe('ProcessRegistryService.getProcess', () => {
  test('(a) одноактовый sov.axncnv: только actions, entity-локаций нет', async () => {
    const apply = makeAction({
      account: 'ledger2',
      name: 'apply',
      data: { action_code: 'sov.axncnv', process_hash: HASH, coopname: COOP, username: 'provider' },
    });
    const walletop = makeAction({
      account: 'ledger2',
      name: 'walletop',
      data: { process_hash: HASH, coopname: COOP },
      global_sequence: '2',
    });

    const svc = makeService({ actions: [apply, walletop], entityDeltasPerLocation: [] });
    const view = await svc.getProcess(HASH, COOP);

    expect(view.process_type).toBe('sov.axncnv');
    expect(view.process_hash).toBe(HASH);
    expect(view.coopname).toBe(COOP);
    expect(view.actions).toHaveLength(2);
    expect(view.delta_history).toHaveLength(0);
    expect(view.documents).toHaveLength(0);
  });

  test('(b) cap.act2res: один процесс, два apply (act2shr+act2ln) в actions', async () => {
    // Оба action_code маппятся в cap.act2res (один процесс акта-2 с двумя
    // эффектами). UI использует action.data.action_code как discriminator
    // для раздельного отображения «приём пая» / «погашение займа» внутри
    // одной карточки процесса.
    const applyShr = makeAction({
      account: 'ledger2',
      name: 'apply',
      data: { action_code: 'cap.act2shr', process_hash: HASH, coopname: COOP },
      global_sequence: '10',
    });
    const applyLn = makeAction({
      account: 'ledger2',
      name: 'apply',
      data: { action_code: 'cap.act2ln', process_hash: HASH, coopname: COOP },
      global_sequence: '11',
    });
    const resultsDelta = makeDelta({
      code: 'capital',
      table: 'results',
      value: { result_hash: HASH, coopname: COOP },
      block_num: 10 as any,
    });

    // PROCESS_HASH_LOCATOR['cap.act2res'] имеет одну локацию — results.
    // Segments/debts не привязаны к result_hash (они по project_hash), так
    // что в entity-дельтах у процесса акта-2 только results.
    const svc = makeService({
      actions: [applyShr, applyLn],
      entityDeltasPerLocation: [[resultsDelta]],
    });
    const view = await svc.getProcess(HASH, COOP);

    expect(view.process_type).toBe('cap.act2res');
    expect(view.actions).toHaveLength(2);
    const actionCodes = view.actions
      .map((a) => (a.data as any)?.action_code)
      .filter(Boolean)
      .sort();
    expect(actionCodes).toEqual(['cap.act2ln', 'cap.act2shr']);
    expect(view.delta_history).toHaveLength(1);
    expect(view.delta_history[0].table).toBe('results');
  });

  test('(c) wall.deposit без документов: deposit-дельта есть, документов нет', async () => {
    const apply = makeAction({
      account: 'ledger2',
      name: 'apply',
      data: { action_code: 'wall.depcpl', process_hash: HASH, coopname: COOP },
    });
    const deposit = makeDelta({
      code: 'wallet',
      table: 'deposits',
      value: { deposit_hash: HASH, coopname: COOP, amount: '100.0000 RUB' }, // нет signed-document
    });

    const svc = makeService({
      actions: [apply],
      entityDeltasPerLocation: [[deposit]],
    });
    const view = await svc.getProcess(HASH, COOP);

    expect(view.process_type).toBe('wall.deposit');
    expect(view.delta_history).toHaveLength(1);
    expect(view.documents).toHaveLength(0);
  });

  test('(d) reg.regist с двумя apply (entrfee + minshare): единый процесс', async () => {
    // Registrar эмитит два inline ledger2::apply с одним process_hash:
    // reg.entrfee (вступительный взнос) + reg.minshare (минимальный паевой).
    // Оба action_code → один process_type "reg.regist".
    const applyEntr = makeAction({
      account: 'ledger2',
      name: 'apply',
      data: { action_code: 'reg.entrfee', process_hash: HASH, coopname: COOP, username: 'newuser' },
      global_sequence: '100',
    });
    const applyShare = makeAction({
      account: 'ledger2',
      name: 'apply',
      data: { action_code: 'reg.minshare', process_hash: HASH, coopname: COOP, username: 'newuser' },
      global_sequence: '101',
    });
    const candidate = makeDelta({
      code: 'registrator',
      table: 'candidates2',
      value: { registration_hash: HASH, coopname: COOP, username: 'newuser' },
    });

    const svc = makeService({
      actions: [applyEntr, applyShare],
      entityDeltasPerLocation: [[candidate]],
    });
    const view = await svc.getProcess(HASH, COOP);

    expect(view.process_type).toBe('reg.regist');
    expect(view.actions).toHaveLength(2);
    expect(view.delta_history).toHaveLength(1);
    expect(view.delta_history[0].table).toBe('candidates2');
  });

  test('(e) mig.opening: только migration-actions, entity-дельт нет', async () => {
    const migApply = makeAction({
      account: 'ledger2',
      name: 'apply',
      data: { action_code: 'mig.opncash', process_hash: HASH, coopname: COOP },
    });

    const svc = makeService({ actions: [migApply], entityDeltasPerLocation: [] });
    const view = await svc.getProcess(HASH, COOP);

    expect(view.process_type).toBe('mig.opening');
    expect(view.delta_history).toHaveLength(0);
  });

  test('(f1) валидация hex-64: неверный hash → BadRequest', async () => {
    const svc = makeService({ actions: [], entityDeltasPerLocation: [] });
    await expect(svc.getProcess('not-a-hash', COOP)).rejects.toThrow(/hex-64/);
  });

  test('(f2) unknown action_code → fail-fast BadRequest', async () => {
    const bogus = makeAction({
      account: 'ledger2',
      name: 'apply',
      data: { action_code: 'unknown.proc', process_hash: HASH, coopname: COOP },
    });
    const svc = makeService({ actions: [bogus], entityDeltasPerLocation: [] });
    await expect(svc.getProcess(HASH, COOP)).rejects.toThrow(
      /Неизвестный action_code|ACTION_CODE_TO_PROCESS_TYPE/,
    );
  });

  test('(f3) 404, если apply-якоря нет (actions пусты)', async () => {
    const svc = makeService({ actions: [], entityDeltasPerLocation: [] });
    await expect(svc.getProcess(HASH, COOP)).rejects.toThrow(/не найден/);
  });
});
