/**
 * Хранилища расходов на Kysely (C28-81): плановые расходы, снимки реквизитов
 * получателей и реестр файлов. Перенос с TypeORM обязан сохранить условия
 * запросов — по ним решается, какие серии продолжит воркер повторов и чьи
 * реквизиты увидит совет.
 */
import { ExpensePlansService } from '~/extensions/expenses/application/services/expense-plans.service';
import { ExpenseRequisiteSnapshotsService } from '~/extensions/expenses/application/services/expense-requisite-snapshots.service';
import { ExpenseFileKyselyRepository } from '~/extensions/expenses/infrastructure/repositories/expense-file.kysely-repository';
import {
  EXPENSES_FILE_STORE,
  EXPENSES_PLAN_STORE,
  EXPENSES_REQUISITE_SNAPSHOT_STORE,
  expensesStoreProviders,
} from '~/extensions/expenses/infrastructure/database/expenses-stores';
import { recordingKysely, type ScriptedResult } from '../helpers/kysely-recorder';
import { storeFrom } from '../helpers/table-store';

const COOP = 'voskhod';

function setup(token: symbol, results: ScriptedResult[] = []) {
  const { db, queries } = recordingKysely(results);
  return { store: storeFrom(expensesStoreProviders, token, db) as never, queries };
}

describe('плановые расходы', () => {
  it('воркер повторов берёт только серии с наступившим сроком, которые ещё не продолжены', async () => {
    const { store, queries } = setup(EXPENSES_PLAN_STORE, [{ rows: [] }]);
    const service = new ExpensePlansService(store, {} as never);

    await service.spawnDueRecurrences();

    expect(queries).toHaveLength(1);
    expect(queries[0].sql).toContain('from "expense_plans"');
    expect(queries[0].sql).toContain('"recurrence" <> $1');
    expect(queries[0].sql).toContain('"next_spawned" = $2');
    expect(queries[0].sql).toContain('"due_date" <= $3');
    expect(queries[0].sql).toContain('order by "id" asc');
    expect(queries[0].parameters[1]).toBe(false);
  });

  it('реестр участка: отбор по кооперативу и участку, порядок — по сроку', async () => {
    const { store, queries } = setup(EXPENSES_PLAN_STORE, [{ rows: [] }]);
    const service = new ExpensePlansService(store, {} as never);

    await expect(service.listPlans(COOP, 'krg')).resolves.toEqual([]);

    expect(queries[0].sql).toContain('"coopname" = $1 and "braname" = $2');
    expect(queries[0].sql).toContain('order by "due_date" asc, "id" asc');
    expect(queries[0].parameters).toEqual([COOP, 'krg']);
  });
});

describe('снимки реквизитов получателей', () => {
  it('пустой набор строк в базу не пишет', async () => {
    const { store, queries } = setup(EXPENSES_REQUISITE_SNAPSHOT_STORE);
    const service = new ExpenseRequisiteSnapshotsService({} as never, store);

    await service.snapshot(COOP, []);

    expect(queries).toHaveLength(0);
  });
});

describe('реестр файлов расхода', () => {
  it('файлы служебной записки ищутся по хэшу в нижнем регистре, свежие первыми', async () => {
    const { store, queries } = setup(EXPENSES_FILE_STORE, [{ rows: [] }]);
    const repository = new ExpenseFileKyselyRepository(store);

    await expect(repository.findByProposal(COOP, 'ABCDEF')).resolves.toEqual([]);

    expect(queries[0].sql).toContain('from "expense_files"');
    expect(queries[0].sql).toContain('order by "uploaded_at" desc');
    expect(queries[0].parameters).toEqual([COOP, 'abcdef']);
  });

  it('повтор загрузки узнаётся по контрольной сумме внутри кооператива', async () => {
    const { store, queries } = setup(EXPENSES_FILE_STORE, [{ rows: [] }]);
    const repository = new ExpenseFileKyselyRepository(store);

    await expect(repository.findByChecksum(COOP, 'sum')).resolves.toBeNull();

    expect(queries[0].sql).toContain('"coopname" = $1 and "checksum_sha256" = $2');
    expect(queries[0].parameters).toEqual([COOP, 'sum', 1]);
  });
});
