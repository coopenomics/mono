import './i18n';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_RIGHTS, RightsGuard } from '@coopenomics/extension-kit';
import { AppsPublishersService } from './application/services/apps-publishers.service';
import { DeveloperExtension } from './developer-extension';
import { DeveloperRights } from './application/access/developer-rights';
import { appsCatalogProxyStoreProviders } from './infrastructure/database/apps-catalog-proxy-stores';
import { AppsCatalogHttpService } from './infrastructure/apps-catalog-http.service';
import { AppsCatalogInstallScriptController } from './application/controllers/install-script.controller';
import { AppsCatalogProxyResolver } from './application/resolvers/apps-catalog-proxy.resolver';

/**
 * Story 9.5.b + 9.4.b — модуль-прокси для публичного каталога apps-catalog.
 *
 * GraphQL `Query.appsCatalogRemotePackages` (9.5.b) + REST
 * `GET /v1/apps-catalog/install/:scope/:name` (9.4.b) + HTTP-клиент к
 * ca-admin. Своя таблица — назначения издателей (`apps_publishers`).
 * Включается в `ExtensionsModule` в общий imports/exports список.
 */
@Module({
  imports: [ConfigModule],
  controllers: [AppsCatalogInstallScriptController],
  providers: [
    AppsCatalogHttpService,
    AppsCatalogProxyResolver,
    AppsPublishersService,
    DeveloperExtension,
    ...appsCatalogProxyStoreProviders,
    DeveloperRights,
    { provide: APP_RIGHTS, useExisting: DeveloperRights },
    RightsGuard,
  ],
  exports: [AppsCatalogHttpService, DeveloperExtension],
})
export class AppsCatalogProxyModule {
  constructor(private readonly developerExtension: DeveloperExtension) {}

  /** Ядро вызывает initialize у экземпляра модуля при установке и включении расширения. */
  async initialize(): Promise<void> {
    await this.developerExtension.initialize();
  }
}
