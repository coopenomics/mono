import { Module } from '@nestjs/common';
import { AppsCatalogHttpService } from './infrastructure/apps-catalog-http.service';
import { AppsCatalogInstallScriptController } from './application/controllers/install-script.controller';
import { AppsCatalogProxyResolver } from './application/resolvers/apps-catalog-proxy.resolver';

/**
 * Story 9.5.b + 9.4.b — модуль-прокси для публичного каталога apps-catalog.
 *
 * GraphQL `Query.appsCatalogRemotePackages` (9.5.b) + REST
 * `GET /v1/apps-catalog/install/:scope/:name` (9.4.b) + HTTP-клиент к
 * ca-admin. Никакого state, никаких миграций, без TypeORM. Включается в
 * `ExtensionsModule` в общий imports/exports список.
 */
@Module({
  controllers: [AppsCatalogInstallScriptController],
  providers: [AppsCatalogHttpService, AppsCatalogProxyResolver],
  exports: [AppsCatalogHttpService],
})
export class AppsCatalogProxyModule {}
