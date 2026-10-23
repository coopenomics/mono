import type { Provider } from '@nestjs/common';
import type { Kysely } from 'kysely';
import { KYSELY, TableStore } from '@coopenomics/extension-kit';
import { AppsPublisherRecord } from '../records/apps-publisher.record';

/** Шлюз таблицы назначений издателей: сервис работает с записями целиком. */
export const APPS_PUBLISHER_STORE = Symbol('AppsCatalogProxy.PublisherStore');

export const appsCatalogProxyStoreProviders: Provider[] = [
  {
    provide: APPS_PUBLISHER_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) => new TableStore<AppsPublisherRecord>(db, { table: 'apps_publishers', primaryKey: ['id'] }),
  },
];
