/**
 * Unit-тесты ProcessRegistryService.
 *
 * Покрывают три сценария из AC Story 4.7:
 *  (a) одноактовый процесс (sov.axncnv) — нет entity-таблицы, только wjournal;
 *  (b) мульти-операционный процесс (cap.act2res) — 2 action_code с одним process_type,
 *      entity-дельты в capital/results + capital/segments;
 *  (c) процесс без документов — нет полей с version/doc_hash/signatures.
 *
 * Все зависимости замокированы (репозитории, DocumentAggregator, Redis) —
 * тест сфокусирован на алгоритме сборки ProcessView.
 */

import { ProcessRegistryService } from '../../../src/domain/process-registry/services/process-registry.service';
import type { DeltaEntity } from '../../../src/infrastructure/database/typeorm/entities/delta.entity';
import type { ActionEntity } from '../../../src/infrastructure/database/typeorm/entities/action.entity';

type AnyQB = any;

// ---------- helpers: моки ----------

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
    account: partial.account ?? '_ledger2',
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

function makeService({
  phaseADeltas,
  phaseBDeltasByLocator,
  actions,
}: {
  phaseADeltas: DeltaEntity[];
  phaseBDeltasByLocator: Record<string, DeltaEntity[]>; // key "code/table/field"
  actions: ActionEntity[];
}): ProcessRegistryService {
  const deltaRepo: any = {
    createQueryBuilder: jest.fn(),
    manager: { query: jest.fn(async () => [{ cnt: '0' }]) },
  };
  const actionRepo: any = {
    createQueryBuilder: jest.fn(() => mockQB(actions)),
    manager: { query: jest.fn(async () => [{ cnt: '0' }]) },
  };

  // Первый вызов QB — phase A (_ledger2 anchors); следующие — phase B по локациям.
  const qbCalls: AnyQB[] = [];
  qbCalls.push(mockQB(phaseADeltas));
  for (const key of Object.keys(phaseBDeltasByLocator)) {
    qbCalls.push(mockQB(phaseBDeltasByLocator[key]));
  }
  let callIdx = 0;
  deltaRepo.createQueryBuilder = jest.fn(() => {
    const qb = qbCalls[callIdx] ?? mockQB([]);
    callIdx += 1;
    return qb;
  });

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
  test('(a) одноактовый процесс sov.axncnv: только wjournal+journal, нет entity-таблиц', async () => {
    const wjournal = makeDelta({
      code: '_ledger2',
      table: 'wjournal',
      value: { process_hash: HASH, process_type: 'sov.axncnv', coopname: COOP, username: 'u1' },
      block_num: 1 as any,
    });
    const journal = makeDelta({
      code: '_ledger2',
      table: 'journal',
      value: { process_hash: HASH, process_type: 'sov.axncnv', coopname: COOP },
      block_num: 1 as any,
    });

    const svc = makeService({
      phaseADeltas: [wjournal, journal],
      phaseBDeltasByLocator: {},
      actions: [],
    });

    const view = await svc.getProcess(HASH, COOP);

    expect(view.process_type).toBe('sov.axncnv');
    expect(view.process_hash).toBe(HASH);
    expect(view.coopname).toBe(COOP);
    expect(view.delta_history).toHaveLength(2);
    expect(view.actions).toHaveLength(0);
    expect(view.documents).toHaveLength(0);
  });

  test('(b) мульти-операционный процесс cap.act2res: 2 entity-локации (results+segments)', async () => {
    const wjournalShr = makeDelta({
      code: '_ledger2',
      table: 'wjournal',
      value: { process_hash: HASH, process_type: 'cap.act2res', coopname: COOP, action_code: 'cap.act2shr' },
      block_num: 10 as any,
    });
    const wjournalLn = makeDelta({
      code: '_ledger2',
      table: 'wjournal',
      value: { process_hash: HASH, process_type: 'cap.act2res', coopname: COOP, action_code: 'cap.act2ln' },
      block_num: 10 as any,
    });
    const resultsDelta = makeDelta({
      code: 'capital',
      table: 'results',
      value: { result_hash: HASH, coopname: COOP },
      block_num: 9 as any,
    });
    const segmentsDelta = makeDelta({
      code: 'capital',
      table: 'segments',
      value: { result_hash: HASH, coopname: COOP },
      block_num: 10 as any,
    });

    const svc = makeService({
      phaseADeltas: [wjournalShr, wjournalLn],
      phaseBDeltasByLocator: {
        'capital/results/result_hash': [resultsDelta],
        'capital/segments/result_hash': [segmentsDelta],
      },
      actions: [],
    });

    const view = await svc.getProcess(HASH, COOP);

    expect(view.process_type).toBe('cap.act2res');
    expect(view.delta_history).toHaveLength(4); // 2 wjournal + 2 entity
    const tables = view.delta_history.map((d) => d.table).sort();
    expect(tables).toEqual(['results', 'segments', 'wjournal', 'wjournal']);
  });

  test('(c) процесс без документов: DocumentFieldDetector не срабатывает', async () => {
    const wjournal = makeDelta({
      code: '_ledger2',
      table: 'wjournal',
      value: { process_hash: HASH, process_type: 'wall.deposit', coopname: COOP },
    });
    const deposit = makeDelta({
      code: 'wallet',
      table: 'deposits',
      value: { deposit_hash: HASH, coopname: COOP, amount: '100.0000 RUB' }, // без signed-document
    });

    const svc = makeService({
      phaseADeltas: [wjournal],
      phaseBDeltasByLocator: {
        'wallet/deposits/deposit_hash': [deposit],
      },
      actions: [],
    });

    const view = await svc.getProcess(HASH, COOP);

    expect(view.process_type).toBe('wall.deposit');
    expect(view.documents).toHaveLength(0);
  });

  test('hash нормализуется к hex-64 lowercase; неверный — BadRequest', async () => {
    const svc = makeService({
      phaseADeltas: [],
      phaseBDeltasByLocator: {},
      actions: [],
    });
    await expect(svc.getProcess('not-a-hash', COOP)).rejects.toThrow(/hex-64/);
  });

  test('неизвестный process_type — fail-fast (BadRequest, просьба обновить локатор)', async () => {
    const bogus = makeDelta({
      code: '_ledger2',
      table: 'wjournal',
      value: { process_hash: HASH, process_type: 'unknown.proc', coopname: COOP },
    });
    const svc = makeService({
      phaseADeltas: [bogus],
      phaseBDeltasByLocator: {},
      actions: [],
    });
    await expect(svc.getProcess(HASH, COOP)).rejects.toThrow(/Неизвестный process_type|PROCESS_HASH_LOCATOR/);
  });

  test('404 Not Found, если в wjournal/journal нет ни одной якорной записи', async () => {
    const svc = makeService({
      phaseADeltas: [],
      phaseBDeltasByLocator: {},
      actions: [],
    });
    await expect(svc.getProcess(HASH, COOP)).rejects.toThrow(/не найден/);
  });
});
