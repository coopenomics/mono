import type { Provider } from '@nestjs/common';
import type { Kysely } from 'kysely';
import { KYSELY, TableStore } from '@coopenomics/extension-kit';
import { ExpenseFileTypeormEntity } from '../entities/expense-file.typeorm-entity';
import { ExpensePlanEntity } from '../entities/expense-plan.entity';
import { ExpenseRequisiteSnapshotTypeormEntity } from '../entities/expense-requisite-snapshot.typeorm-entity';

/**
 * Шлюзы таблиц расширения: адаптеры хранилищ работают с записями целиком
 * (прочитал, поправил, сохранил), запросы к базе идут через Kysely.
 */
export const EXPENSES_FILE_STORE = Symbol('Expense.EXPENSES_FILE_STORE');
export const EXPENSES_PLAN_STORE = Symbol('Expense.EXPENSES_PLAN_STORE');
export const EXPENSES_REQUISITE_SNAPSHOT_STORE = Symbol('Expense.EXPENSES_REQUISITE_SNAPSHOT_STORE');

export const expensesStoreProviders: Provider[] = [
  {
    provide: EXPENSES_FILE_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<ExpenseFileTypeormEntity>(db, {
        table: 'expense_files',
        primaryKey: ['id'],
        sameNames: true,
      }),
  },
  {
    provide: EXPENSES_PLAN_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<ExpensePlanEntity>(db, {
        table: 'expense_plans',
        primaryKey: ['id'],
        updatedAt: 'updatedAt',
      }),
  },
  {
    provide: EXPENSES_REQUISITE_SNAPSHOT_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<ExpenseRequisiteSnapshotTypeormEntity>(db, {
        table: 'expense_requisite_snapshots',
        primaryKey: ['id'],
        json: ['data'],
        sameNames: true,
      }),
  },
];
