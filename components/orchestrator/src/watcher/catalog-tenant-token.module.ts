import { Global, Module } from '@nestjs/common';
import { CatalogTenantToken, CatalogTenantTokenController } from './catalog-tenant-token';

/**
 * Один токен на процесс: его читают watcher (подписки, установка) и кэш
 * фронт-частей (сверка sha256). Глобальный модуль — потому что WatcherModule
 * импортирует FrontendCacheModule, и общий провайдер через импорт дал бы цикл.
 */
@Global()
@Module({
  controllers: [CatalogTenantTokenController],
  providers: [CatalogTenantToken],
  exports: [CatalogTenantToken],
})
export class CatalogTenantTokenModule {}
