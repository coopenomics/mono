import type { Provider } from '@nestjs/common';
import type { Kysely } from 'kysely';
import { KYSELY, TableStore } from '@coopenomics/extension-kit';
import { ApprovalRecord, EntityName } from '../entities/approval.record';

/** Шлюз таблицы одобрений председателя. */
export const CHAIRMAN_APPROVAL_STORE = Symbol('Chairman.CHAIRMAN_APPROVAL_STORE');

export const chairmanStoreProviders: Provider[] = [
  {
    provide: CHAIRMAN_APPROVAL_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<ApprovalRecord>(db, {
        table: EntityName,
        primaryKey: ['_id'],
        json: ['document', 'approved_document'],
        updatedAt: '_updated_at',
        sameNames: true,
        columns: ['_id', 'block_num', 'present', 'status', '_created_at', '_updated_at', 'id', 'coopname', 'username', 'document', 'approval_hash', 'callback_contract', 'callback_action_approve', 'callback_action_decline', 'meta', 'created_at', 'approved_document'],
      }),
  },
];
