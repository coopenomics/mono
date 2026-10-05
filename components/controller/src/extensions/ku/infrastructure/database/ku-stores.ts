import type { Provider } from '@nestjs/common';
import type { Kysely } from 'kysely';
import { KYSELY, TableStore } from '@coopenomics/extension-kit';
import { KuDecisionQuestionTypeormEntity } from '../entities/ku-decision-question.typeorm-entity';
import { KuDecisionTypeormEntity } from '../entities/ku-decision.typeorm-entity';
import { KuTrustRequestTypeormEntity } from '../entities/ku-trust-request.typeorm-entity';

/** Шлюзы таблиц: хранилища работают с записями целиком через `TableStore`. */
export const KU_DECISION_QUESTION_STORE = Symbol('Ku.KU_DECISION_QUESTION_STORE');
export const KU_DECISION_STORE = Symbol('Ku.KU_DECISION_STORE');
export const KU_TRUST_REQUEST_STORE = Symbol('Ku.KU_TRUST_REQUEST_STORE');

export const kuStoreProviders: Provider[] = [
  {
    provide: KU_DECISION_QUESTION_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<KuDecisionQuestionTypeormEntity>(db, {
        table: 'ku_decision_questions',
        primaryKey: ['_id'],
        json: ['voters_for', 'voters_against', 'voters_abstained'],
        updatedAt: '_updated_at',
        sameNames: true,
        columns: ['_id', 'block_num', 'present', 'status', '_created_at', '_updated_at', 'id', 'decision_id', 'number', 'coopname', 'title', 'decision', 'context', 'counter_votes_for', 'counter_votes_against', 'counter_votes_abstained', 'voters_for', 'voters_against', 'voters_abstained'],
      }),
  },
  {
    provide: KU_DECISION_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<KuDecisionTypeormEntity>(db, {
        table: 'ku_decisions',
        primaryKey: ['_id'],
        json: ['proposal', 'protocol', 'petition', 'liability', 'authority', 'authorization', 'participants'],
        updatedAt: '_updated_at',
        sameNames: true,
        columns: ['_id', 'block_num', 'present', 'status', '_created_at', '_updated_at', 'id', 'hash', 'coopname', 'type', 'initiator', 'chairman', 'proposal', 'protocol', 'petition', 'liability', 'authority', 'authorization', 'open_at', 'close_at', 'signed_ballots', 'braname', 'address', 'participants', 'created_at', 'meet_place', 'meet_at', 'branch_name', 'branch_email', 'branch_phone', 'cancelled', 'meet_reminder_sent'],
      }),
  },
  {
    provide: KU_TRUST_REQUEST_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<KuTrustRequestTypeormEntity>(db, {
        table: 'ku_trust_requests',
        primaryKey: ['_id'],
        json: ['application', 'authority'],
        updatedAt: '_updated_at',
        sameNames: true,
        columns: ['_id', 'block_num', 'present', 'status', '_created_at', '_updated_at', 'id', 'hash', 'coopname', 'braname', 'username', 'application', 'authority'],
      }),
  },
];
