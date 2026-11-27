import type { Provider } from '@nestjs/common';
import type { Kysely } from 'kysely';
import { KYSELY, TableStore } from '@coopenomics/extension-kit';
import { AppsPublisherRecord } from '../records/apps-publisher.record';
import { CatalogAppRecord } from '../records/catalog-app.record';
import { AppPortGrantRecord } from '../records/app-port-grant.record';
import { AppRightsConsentRecord } from '../records/app-rights-consent.record';

export const APPS_PUBLISHER_STORE = Symbol('AppsCatalogProxy.PublisherStore');
export const CATALOG_APP_STORE = Symbol('AppsCatalogProxy.CatalogAppStore');
export const APP_PORT_GRANT_STORE = Symbol('AppsCatalogProxy.AppPortGrantStore');
export const APP_RIGHTS_CONSENT_STORE = Symbol('AppsCatalogProxy.AppRightsConsentStore');

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
  {
    provide: APP_PORT_GRANT_STORE,
    inject: [KYSELY],
    useFactory: (db: Kysely<any>) =>
      new TableStore<AppPortGrantRecord>(db, {
        table: 'apps_port_grants',
        primaryKey: ['packageId'],
        json: ['ports', 'chainActions'],
      }),
  },
  {
    provide: APP_RIGHTS_CONSENT_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<AppRightsConsentRecord>(db, {
        table: 'apps_rights_consents',
        primaryKey: ['packageId'],
        json: ['ports', 'chainActions', 'pendingPorts', 'pendingChainActions'],
      }),
  },
];
