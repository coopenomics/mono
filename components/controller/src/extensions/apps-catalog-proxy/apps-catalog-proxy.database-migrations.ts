import { AppsCatalogProxyCreateAppsPublishers1792737049670 } from './migrations/database/1792737049670-create-apps-publishers';
import { AppsCatalogProxyCreateCatalogApps1793100000000 } from './migrations/database/1793100000000-create-apps-catalog-apps';
import { AppsCatalogProxyCreatePortGrants1795650000000 } from './migrations/database/1795650000000-create-apps-port-grants';
import { AppsCatalogProxyCreateRightsConsents1795780000000 } from './migrations/database/1795780000000-create-apps-rights-consents';
import { AppsCatalogProxyRightsConsentsAutoAcceptDefault1795900000000 } from './migrations/database/1795900000000-rights-consents-auto-accept-default';

export const appsCatalogProxyDatabaseMigrations = [
  AppsCatalogProxyCreateAppsPublishers1792737049670,
  AppsCatalogProxyCreateCatalogApps1793100000000,
  AppsCatalogProxyCreatePortGrants1795650000000,
  AppsCatalogProxyCreateRightsConsents1795780000000,
  AppsCatalogProxyRightsConsentsAutoAcceptDefault1795900000000,
];
