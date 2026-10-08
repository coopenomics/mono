import type { Provider } from '@nestjs/common';
import type { Kysely } from 'kysely';
import { KYSELY, TableStore } from '@coopenomics/extension-kit';
import { LoanRecord } from '../entities/loan.record';

/** Шлюз таблицы зеркала займов: запросы к базе идут через Kysely. */
export const DEBT_LOAN_STORE = Symbol('Debt.DEBT_LOAN_STORE');

export const debtStoreProviders: Provider[] = [
  {
    provide: DEBT_LOAN_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<LoanRecord>(db, {
        table: 'debt_loans',
        primaryKey: ['_id'],
        json: ['statement', 'contract', 'signed_contract', 'decision', 'extension_statement'],
        sameNames: true,
      }),
  },
];
