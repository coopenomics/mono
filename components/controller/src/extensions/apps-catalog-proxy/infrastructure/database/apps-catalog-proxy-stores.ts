import type { Provider } from '@nestjs/common';
import type { Kysely } from 'kysely';
import { KYSELY, TableStore } from '@coopenomics/extension-kit';
import { AppsPublisherRecord } from '../records/apps-publisher.record';
import { CatalogAppRecord } from '../records/catalog-app.record';

export const APPS_PUBLISHER_STORE = Symbol('AppsCatalogProxy.PublisherStore');
export const CATALOG_APP_STORE = Symbol('AppsCatalogProxy.CatalogAppStore');

export const appsCatalogProxyStoreProviders: Provider[] = [
  {
    provide: APPS_PUBLISHER_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) => new TableStore<AppsPublisherRecord>(db, { table: 'apps_publishers', primaryKey: ['id'] }),
  },
  {
    provide: CATALOG_APP_STORE,
    inject: [KYSELY],
    useFactory: (db: Kysely<any>) =>
      new TableStore<CatalogAppRecord>(db, { table: 'apps_catalog_apps', primaryKey: ['packageId'], json: ['config'] }),
  },
];
