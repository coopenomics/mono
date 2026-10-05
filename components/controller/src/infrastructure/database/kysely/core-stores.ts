import type { Provider } from '@nestjs/common';
import type { Kysely } from 'kysely';
import { KYSELY, TableStore } from '@coopenomics/extension-kit';
import { AgreementTypeormEntity } from '../typeorm/entities/agreement.typeorm-entity';
import { ProgramWalletTypeormEntity } from '../typeorm/entities/program-wallet.typeorm-entity';
import { UserAgreementTypeormEntity } from '../typeorm/entities/user-agreement.typeorm-entity';
import { UserWalletTypeormEntity } from '../typeorm/entities/user-wallet.typeorm-entity';

/** Шлюзы таблиц: хранилища работают с записями целиком через `TableStore`. */
export const CORE_AGREEMENT_STORE = Symbol('Core.CORE_AGREEMENT_STORE');
export const CORE_PROGRAM_WALLET_STORE = Symbol('Core.CORE_PROGRAM_WALLET_STORE');
export const CORE_USER_AGREEMENT_STORE = Symbol('Core.CORE_USER_AGREEMENT_STORE');
export const CORE_USER_WALLET_STORE = Symbol('Core.CORE_USER_WALLET_STORE');

export const coreStoreProviders: Provider[] = [
  {
    provide: CORE_AGREEMENT_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<AgreementTypeormEntity>(db, {
        table: 'agreements',
        primaryKey: ['_id'],
        json: ['document'],
        updatedAt: '_updated_at',
        sameNames: true,
        columns: ['_id', 'block_num', 'present', 'status', '_created_at', '_updated_at', 'id', 'coopname', 'username', 'type', 'program_id', 'draft_id', 'version', 'document', 'blockchain_status', 'updated_at'],
      }),
  },
  {
    provide: CORE_PROGRAM_WALLET_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<ProgramWalletTypeormEntity>(db, {
        table: 'program_wallets',
        primaryKey: ['_id'],
        updatedAt: '_updated_at',
        sameNames: true,
        columns: ['_id', 'block_num', 'present', 'status', '_created_at', '_updated_at', 'id', 'coopname', 'program_id', 'agreement_id', 'username', 'available', 'blocked', 'membership_contribution'],
      }),
  },
  {
    provide: CORE_USER_AGREEMENT_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<UserAgreementTypeormEntity>(db, {
        table: 'user_agreements',
        primaryKey: ['_id'],
        json: ['programs'],
        updatedAt: '_updated_at',
        sameNames: true,
        columns: ['_id', 'block_num', 'present', 'status', '_created_at', '_updated_at', 'coopname', 'username', 'programs'],
      }),
  },
  {
    provide: CORE_USER_WALLET_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<UserWalletTypeormEntity>(db, {
        table: 'user_wallets',
        primaryKey: ['_id'],
        updatedAt: '_updated_at',
        sameNames: true,
        columns: ['_id', 'block_num', 'present', 'status', '_created_at', '_updated_at', 'id', 'coopname', 'wallet_name', 'username', 'available', 'blocked'],
      }),
  },
];
