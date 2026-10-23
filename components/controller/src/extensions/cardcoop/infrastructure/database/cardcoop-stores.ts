import type { Provider } from '@nestjs/common';
import type { Kysely } from 'kysely';
import { KYSELY, TableStore } from '@coopenomics/extension-kit';
import { CardcoopAttestationRecord } from '../records/cardcoop-attestation.record';
import { CardcoopConnectStateRecord } from '../records/cardcoop-connect-state.record';
import { CardcoopEntrySessionRecord } from '../records/cardcoop-entry-session.record';
import { CardcoopOperatorAnnouncementRecord } from '../records/cardcoop-operator-announcement.record';
import { CardcoopPendingExitRecord } from '../records/cardcoop-pending-exit.record';
import { CardcoopPendingLinkRecord } from '../records/cardcoop-pending-link.record';
import { CardcoopUsedGrantRecord } from '../records/cardcoop-used-grant.record';

/**
 * Шлюзы таблиц «Карты кооператора»: сервисы расширения работают с записями
 * целиком (прочитал, поправил, сохранил), запросы к базе идут через Kysely.
 */
export const CARDCOOP_ATTESTATION_STORE = Symbol('Cardcoop.AttestationStore');
export const CARDCOOP_CONNECT_STATE_STORE = Symbol('Cardcoop.ConnectStateStore');
export const CARDCOOP_ENTRY_SESSION_STORE = Symbol('Cardcoop.EntrySessionStore');
export const CARDCOOP_OPERATOR_ANNOUNCEMENT_STORE = Symbol('Cardcoop.OperatorAnnouncementStore');
export const CARDCOOP_PENDING_EXIT_STORE = Symbol('Cardcoop.PendingExitStore');
export const CARDCOOP_PENDING_LINK_STORE = Symbol('Cardcoop.PendingLinkStore');
export const CARDCOOP_USED_GRANT_STORE = Symbol('Cardcoop.UsedGrantStore');

export const cardcoopStoreProviders: Provider[] = [
  {
    provide: CARDCOOP_ATTESTATION_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) => new TableStore<CardcoopAttestationRecord>(db, { table: 'cardcoop_attestations', primaryKey: ['id'], updatedAt: 'updatedAt' }),
  },
  {
    provide: CARDCOOP_CONNECT_STATE_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) => new TableStore<CardcoopConnectStateRecord>(db, { table: 'cardcoop_connect_state', primaryKey: ['id'], updatedAt: 'updatedAt' }),
  },
  {
    provide: CARDCOOP_ENTRY_SESSION_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) => new TableStore<CardcoopEntrySessionRecord>(db, { table: 'cardcoop_entry_sessions', primaryKey: ['id'], json: ['memberships', 'profile'], updatedAt: 'updatedAt' }),
  },
  {
    provide: CARDCOOP_OPERATOR_ANNOUNCEMENT_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) => new TableStore<CardcoopOperatorAnnouncementRecord>(db, { table: 'cardcoop_operator_announcements', primaryKey: ['coopname'], updatedAt: 'updatedAt' }),
  },
  {
    provide: CARDCOOP_PENDING_EXIT_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) => new TableStore<CardcoopPendingExitRecord>(db, { table: 'cardcoop_pending_exits', primaryKey: ['exitHash'] }),
  },
  {
    provide: CARDCOOP_PENDING_LINK_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) => new TableStore<CardcoopPendingLinkRecord>(db, { table: 'cardcoop_pending_links', primaryKey: ['username'], updatedAt: 'updatedAt' }),
  },
  {
    provide: CARDCOOP_USED_GRANT_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) => new TableStore<CardcoopUsedGrantRecord>(db, { table: 'cardcoop_used_grants', primaryKey: ['grantJti'] }),
  },
];

export const cardcoopStoreTokens = [CARDCOOP_ATTESTATION_STORE, CARDCOOP_CONNECT_STATE_STORE, CARDCOOP_ENTRY_SESSION_STORE, CARDCOOP_OPERATOR_ANNOUNCEMENT_STORE, CARDCOOP_PENDING_EXIT_STORE, CARDCOOP_PENDING_LINK_STORE, CARDCOOP_USED_GRANT_STORE];
