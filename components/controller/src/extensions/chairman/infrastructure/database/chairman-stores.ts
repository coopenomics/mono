import type { Provider } from '@nestjs/common';
import type { Kysely } from 'kysely';
import { KYSELY, TableStore } from '@coopenomics/extension-kit';
import { ApprovalTypeormEntity, EntityName } from '../entities/approval-typeorm.entity';

/** Шлюз таблицы одобрений председателя. */
export const CHAIRMAN_APPROVAL_STORE = Symbol('Chairman.CHAIRMAN_APPROVAL_STORE');

export const chairmanStoreProviders: Provider[] = [
  {
    provide: CHAIRMAN_APPROVAL_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<ApprovalTypeormEntity>(db, {
        table: EntityName,
        primaryKey: ['_id'],
        json: ['document', 'approved_document'],
        updatedAt: '_updated_at',
        sameNames: true,
      }),
  },
];
