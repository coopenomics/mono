/**
 * Unit-тесты ProcessRegistryService (Epic 4 + Epic 1 addendum + review).
 *
 * Phase A теперь идёт по blockchain_actions (name='apply', cross-account
 * scan). process_type выводится из OPERATION_CODE_TO_PROCESS_TYPE[operationCode].
 * Phase B — entity-дельты из PROCESS_HASH_LOCATOR по текущим таблицам/полям
 * (candidates2.registration_hash, results.result_hash, pgproperties.property_hash,
 * requests.hash — не "regs"/"properties"/"request_hash").
 *
 * Покрывают:
 *  (a) одноактовый процесс p.sov.axncnv — нет entity-таблиц;
 *  (b) мульти-эффектный p.cap.rid — 2 apply с operation_code o.cap.accept +
 *      o.cap.repay под одним process_hash, оба попадают в actions[], разделить
 *      UI по action.data.operation_code;
 *  (c) процесс без документов (p.wal.depo) — dep-дельта без signed-полей;
 *  (d) p.reg.accept с двумя apply (o.reg.setent + o.reg.setmin) — единый процесс;
 *  (e) миграционный p.mig.trans — только actions, entity-дельт нет;
 *  (f) валидация hex-64, fail-fast на unknown operation_code, 404 без apply-якоря.
 *
 * ВАЖНО про имена. operation_code и process_type пишутся С префиксами `o.`/`p.` —
 * так их эмитит контракт (см. ledger2.hpp: `o.adj.rev`, `o.mig.*`) и так они
 * лежат в LEDGER2_OPERATION_REGISTRY. Беспрефиксные коды прошлого поколения
 * (reg.entrfee, cap.act2shr, wall.depcpl, mig.opncash) в реестре отсутствуют —
 * не возвращать их сюда, тест начнёт врать зелёным при живом рассинхроне.
 */

import { ProcessRegistryService } from '../../../src/domain/process-registry/services/process-registry.service';
import type { DeltaEntity } from '../../../src/infrastructure/database/typeorm/entities/delta.entity';
import type { ActionEntity } from '../../../src/infrastructure/database/typeorm/entities/action.entity';
import type { PaginationInputDTO } from '../../../src/application/common/dto/pagination.dto';

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
  test('(a) одноактовый p.sov.axncnv: только actions, entity-локаций нет', async () => {
    const apply = makeAction({
      account: 'ledger2',
      name: 'apply',
      data: { operation_code: 'o.sov.axncnv', process_hash: HASH, coopname: COOP, username: 'provider' },
    });
    const walletop = makeAction({
      account: 'ledger2',
      name: 'walletop',
      data: { process_hash: HASH, coopname: COOP },
      global_sequence: '2',
    });

    const svc = makeService({ actions: [apply, walletop], entityDeltasPerLocation: [] });
    const view = await svc.getProcess(HASH, COOP);

    expect(view.process_type).toBe('p.sov.axncnv');
    expect(view.process_hash).toBe(HASH);
    expect(view.coopname).toBe(COOP);
    expect(view.actions).toHaveLength(2);
    expect(view.delta_history).toHaveLength(0);
    expect(view.documents).toHaveLength(0);
  });

  test('(b) p.cap.rid: один процесс, два apply (accept+repay) в actions', async () => {
    // Оба operation_code маппятся в p.cap.rid (один процесс акта-2 с двумя
    // эффектами). UI использует action.data.operation_code как discriminator
    // для раздельного отображения «приём РИД в паевой фонд» / «возврат займа»
    // внутри одной карточки процесса. См. PROCESS_HASH_LOCATOR['p.cap.rid']:
    // до четырёх операций на один result_hash, из них accept и repay — акт-2.
    const applyShr = makeAction({
      account: 'ledger2',
      name: 'apply',
      data: { operation_code: 'o.cap.accept', process_hash: HASH, coopname: COOP },
      global_sequence: '10',
    });
    const applyLn = makeAction({
      account: 'ledger2',
      name: 'apply',
      data: { operation_code: 'o.cap.repay', process_hash: HASH, coopname: COOP },
      global_sequence: '11',
    });
    const resultsDelta = makeDelta({
      code: 'capital',
      table: 'results',
      value: { result_hash: HASH, coopname: COOP },
      block_num: 10 as any,
    });

    // PROCESS_HASH_LOCATOR['p.cap.rid'] имеет одну локацию — results.
    // Segments/debts не привязаны к result_hash (они по project_hash), так
    // что в entity-дельтах у процесса акта-2 только results.
    const svc = makeService({
      actions: [applyShr, applyLn],
      entityDeltasPerLocation: [[resultsDelta]],
    });
    const view = await svc.getProcess(HASH, COOP);

    expect(view.process_type).toBe('p.cap.rid');
    expect(view.actions).toHaveLength(2);
    const actionCodes = view.actions
      .map((a) => (a.data as any)?.operation_code)
      .filter(Boolean)
      .sort();
    expect(actionCodes).toEqual(['o.cap.accept', 'o.cap.repay']);
    expect(view.delta_history).toHaveLength(1);
    expect(view.delta_history[0].table).toBe('results');
  });

  test('(c) p.wal.depo без документов: deposit-дельта есть, документов нет', async () => {
    const apply = makeAction({
      account: 'ledger2',
      name: 'apply',
      data: { operation_code: 'o.wal.depcpl', process_hash: HASH, coopname: COOP },
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

    expect(view.process_type).toBe('p.wal.depo');
    expect(view.delta_history).toHaveLength(1);
    expect(view.documents).toHaveLength(0);
  });

  test('(d) p.reg.accept с двумя apply (setent + setmin): единый процесс', async () => {
    // Registrator на confirmreg эмитит два inline ledger2::apply с одним
    // process_hash (= registration_hash): o.reg.setent (зачисление
    // вступительного взноса по решению совета) + o.reg.setmin (зачисление
    // минимального паевого). Оба operation_code → один process_type
    // p.reg.accept. См. комментарий к PROCESS_HASH_LOCATOR['p.reg.accept'].
    const applyEntr = makeAction({
      account: 'ledger2',
      name: 'apply',
      data: { operation_code: 'o.reg.setent', process_hash: HASH, coopname: COOP, username: 'newuser' },
      global_sequence: '100',
    });
    const applyShare = makeAction({
      account: 'ledger2',
      name: 'apply',
      data: { operation_code: 'o.reg.setmin', process_hash: HASH, coopname: COOP, username: 'newuser' },
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

    expect(view.process_type).toBe('p.reg.accept');
    expect(view.actions).toHaveLength(2);
    expect(view.delta_history).toHaveLength(1);
    expect(view.delta_history[0].table).toBe('candidates2');
  });

  test('(e) p.mig.trans: только migration-actions, entity-дельт нет', async () => {
    // Транзит остатка паевых взносов деньгами. Все o.mig.* сведены в один
    // process_type p.mig.trans, у которого в локаторе пустой список локаций:
    // миграция пишет только wjournal/journal + accounts2/wallets2.
    const migApply = makeAction({
      account: 'ledger2',
      name: 'apply',
      data: { operation_code: 'o.mig.share', process_hash: HASH, coopname: COOP },
    });

    const svc = makeService({ actions: [migApply], entityDeltasPerLocation: [] });
    const view = await svc.getProcess(HASH, COOP);

    expect(view.process_type).toBe('p.mig.trans');
    expect(view.delta_history).toHaveLength(0);
  });

  test('(f1) валидация hex-64: неверный hash → BadRequest', async () => {
    const svc = makeService({ actions: [], entityDeltasPerLocation: [] });
    await expect(svc.getProcess('not-a-hash', COOP)).rejects.toThrow(/hex-64/);
  });

  test('(f2) unknown operation_code → fail-fast BadRequest', async () => {
    const bogus = makeAction({
      account: 'ledger2',
      name: 'apply',
      data: { operation_code: 'o.unknown.proc', process_hash: HASH, coopname: COOP },
    });
    const svc = makeService({ actions: [bogus], entityDeltasPerLocation: [] });
    await expect(svc.getProcess(HASH, COOP)).rejects.toThrow(
      /Неизвестный operation_code|OPERATION_CODE_TO_PROCESS_TYPE/,
    );
  });

  test('(f3) 404, если apply-якоря нет (actions пусты)', async () => {
    const svc = makeService({ actions: [], entityDeltasPerLocation: [] });
    await expect(svc.getProcess(HASH, COOP)).rejects.toThrow(/не найден/);
  });

  test('(g1) нитка поставки с инлайновым взносом КУ называется поставкой', async () => {
    // marketplace::signiss2 вызывает branch::accrue инлайн с process_hash заказа,
    // поэтому o.brn.common живёт в нитке поставки. По исторической карте эта
    // операция объявлена под p.brn.fees — имя нитки она давать не должна, иначе
    // поставка подписывается «Членские взносы кооперативного участка».
    const lock = makeAction({
      account: 'ledger2',
      name: 'apply',
      data: { operation_code: 'o.mkt.lock', process_hash: HASH, coopname: COOP, username: 'orderer' },
      global_sequence: '10',
    });
    const fee = makeAction({
      account: 'ledger2',
      name: 'apply',
      data: { operation_code: 'o.brn.common', process_hash: HASH, coopname: COOP, username: 'krasnogorsk' },
      global_sequence: '11',
    });
    const order = makeDelta({
      code: 'marketplace',
      table: 'orders',
      value: { hash: HASH, coopname: COOP },
    });

    const svc = makeService({ actions: [lock, fee], entityDeltasPerLocation: [[order]] });
    const view = await svc.getProcess(HASH, COOP);

    expect(view.process_type).toBe('p.mkt.supply');
    expect(view.delta_history[0].table).toBe('orders');
  });

  test('(g2) нитка гарантийного возврата с инлайновым возвратом взноса КУ', async () => {
    // marketplace::accretrn вызывает branch::retfee с хэшем заявки на возврат.
    const ret = makeAction({
      account: 'ledger2',
      name: 'apply',
      data: { operation_code: 'o.mkt.return', process_hash: HASH, coopname: COOP, username: 'orderer' },
      global_sequence: '20',
    });
    const retfee = makeAction({
      account: 'ledger2',
      name: 'apply',
      data: { operation_code: 'o.brn.retfee', process_hash: HASH, coopname: COOP, username: 'krasnogorsk' },
      global_sequence: '21',
    });

    const svc = makeService({ actions: [ret, retfee], entityDeltasPerLocation: [[]] });
    const view = await svc.getProcess(HASH, COOP);

    expect(view.process_type).toBe('p.mkt.return');
  });

  test('(g3) порядок операций в нитке имени не меняет', async () => {
    // Тот же набор, что в (g1), но взнос идёт первым: имя нитки не должно
    // зависеть ни от порядка блоков, ни от алфавита operation_code.
    const fee = makeAction({
      account: 'ledger2',
      name: 'apply',
      data: { operation_code: 'o.brn.common', process_hash: HASH, coopname: COOP, username: 'krasnogorsk' },
      global_sequence: '9',
    });
    const lock = makeAction({
      account: 'ledger2',
      name: 'apply',
      data: { operation_code: 'o.mkt.lock', process_hash: HASH, coopname: COOP, username: 'orderer' },
      global_sequence: '10',
    });

    const svc = makeService({ actions: [fee, lock], entityDeltasPerLocation: [[]] });
    const view = await svc.getProcess(HASH, COOP);

    expect(view.process_type).toBe('p.mkt.supply');
  });

  test('(g4) эмитированный контрактом process_type побеждает историческую карту', async () => {
    // После того как контракт начал эмитить имя нитки, оно читается дословно —
    // историческая карта operation_code → process_type больше не применяется.
    const apply = makeAction({
      account: 'ledger2',
      name: 'apply',
      data: {
        operation_code: 'o.brn.common',
        process_type: 'p.mkt.supply',
        process_hash: HASH,
        coopname: COOP,
        username: 'krasnogorsk',
      },
    });

    const svc = makeService({ actions: [apply], entityDeltasPerLocation: [[]] });
    const view = await svc.getProcess(HASH, COOP);

    expect(view.process_type).toBe('p.mkt.supply');
  });
});

// ---------- listProcesses ----------

/**
 * `listProcesses` идёт через raw SQL (`manager.query`): первый вызов — COUNT,
 * второй — страница строк. Мок отдаёт готовые строки агрегата и запоминает
 * запросы, чтобы проверить условия фильтра.
 */
function makeListService(rows: any[]): { svc: ProcessRegistryService; query: jest.Mock } {
  const query = jest.fn(async (sql: string) => {
    if (/COUNT\(/i.test(sql)) return [{ cnt: String(rows.length) }];
    return rows;
  });
  const repo: any = { createQueryBuilder: jest.fn(() => mockQB([])), manager: { query } };
  const aggregator: any = { buildDocumentAggregate: jest.fn() };
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
  return {
    svc: new ProcessRegistryService(repo, repo, aggregator, redisClient, logger),
    query,
  };
}

function makeRow(partial: {
  operationCodes: (string | null)[];
  processTypes?: (string | null)[];
  usernames?: (string | null)[];
  processHash?: string;
}) {
  return {
    operationCodes: partial.operationCodes,
    processTypes: partial.processTypes ?? partial.operationCodes.map(() => null),
    usernames: partial.usernames ?? partial.operationCodes.map(() => null),
    processHash: partial.processHash ?? HASH,
    coopname: COOP,
    firstSeenAt: '2026-08-10T19:11:00Z',
    lastSeenAt: '2026-08-11T09:39:00Z',
    lastBlockNum: '100',
  };
}

const PAGE: PaginationInputDTO = { page: 1, limit: 10, sortOrder: 'ASC' };

describe('ProcessRegistryService.listProcesses', () => {
  test('нитка поставки: имя — поставка, субъект — заказчик, а не участок', async () => {
    const { svc } = makeListService([
      makeRow({
        operationCodes: ['o.mkt.lock', 'o.brn.common'],
        usernames: ['orderer', 'krasnogorsk'],
      }),
    ]);

    const page = await svc.listProcesses({ coopname: COOP }, PAGE);

    expect(page.items).toHaveLength(1);
    expect(page.items[0].processType).toBe('p.mkt.supply');
    expect(page.items[0].username).toBe('orderer');
  });

  test('список и деталь называют один процесс одинаково', async () => {
    const codes = ['o.mkt.lock', 'o.brn.common'];
    const { svc: listSvc } = makeListService([makeRow({ operationCodes: codes })]);
    const detailSvc = makeService({
      actions: codes.map((code, i) =>
        makeAction({
          account: 'ledger2',
          name: 'apply',
          data: { operation_code: code, process_hash: HASH, coopname: COOP },
          global_sequence: String(10 + i),
        }),
      ),
      entityDeltasPerLocation: [[]],
    });

    const page = await listSvc.listProcesses({ coopname: COOP }, PAGE);
    const view = await detailSvc.getProcess(HASH, COOP);

    expect(page.items[0].processType).toBe(view.process_type);
  });

  test('нитка с эмитированным именем читается дословно', async () => {
    const { svc } = makeListService([
      makeRow({
        operationCodes: ['o.brn.common'],
        processTypes: ['p.mkt.supply'],
        usernames: ['krasnogorsk'],
      }),
    ]);

    const page = await svc.listProcesses({ coopname: COOP }, PAGE);

    expect(page.items[0].processType).toBe('p.mkt.supply');
  });

  test('незнакомый код операции не выбрасывает запись из реестра', async () => {
    // Историческая запись старее текущего реестра операций: показываем её без
    // типа, но не теряем — реестр обязан показывать всё, что есть в цепи.
    const { svc } = makeListService([makeRow({ operationCodes: ['o.unknown.proc'] })]);

    const page = await svc.listProcesses({ coopname: COOP }, PAGE);

    expect(page.items).toHaveLength(1);
    expect(page.items[0].processType).toBe('');
    expect(page.items[0].processHash).toBe(HASH);
  });

  test('фильтр «взносы КУ» не разворачивается в инлайновые операции поставки', async () => {
    const { svc, query } = makeListService([]);

    await svc.listProcesses({ coopname: COOP, processType: 'p.brn.fees' }, PAGE);

    const codeParams = query.mock.calls
      .flatMap((call) => (call[1] ?? []) as unknown[])
      .filter((p): p is string[] => Array.isArray(p))
      .flat();
    expect(codeParams).toContain('o.brn.person');
    expect(codeParams).not.toContain('o.brn.common');
    expect(codeParams).not.toContain('o.brn.retfee');
  });

  test('фильтр по типу учитывает и эмитированное имя, и историческую карту', async () => {
    const { svc, query } = makeListService([]);

    await svc.listProcesses({ coopname: COOP, processType: 'p.mkt.supply' }, PAGE);

    const sql = String(query.mock.calls[0][0]);
    expect(sql).toContain("a.data ->> 'process_type'");
    expect(sql).toContain("a.data ->> 'operation_code'");
  });
});
