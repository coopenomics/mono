/**
 * @fileoverview Nest-модуль кэша фронт-частей расширений (E12-2).
 *
 * Конфигурация через ENV (все опциональны — degraded mode без каталога):
 *
 *  - `APPS_CATALOG_OPERATOR_URL` + `APPS_CATALOG_OPERATOR_API_KEY` — catalog-operator контура
 *    (те же имена, что у coopback-прокси); без них источник Noop —
 *    кэш живёт на том, что уже на диске;
 *  - `FRONTEND_CACHE_DIR` — каталог volume-кэша
 *    (default `/var/orchestrator/frontend-cache`);
 *  - `CATALOG_SIGNING_KEY` + `CATALOG_DELIVERY_BASE_URL` — включают независимую
 *    sha256-сверку с манифестом в catalog-delivery registry (тот же signed-request
 *    канал, что у auto-install watcher'а); без них принимаем по
 *    заголовку catalog-operator.
 *
 * Свой экземпляр {@link CatalogDeliveryReleaseMetadata} (а не общий с WatcherModule):
 * Nest резолвит провайдеры в scope модуля-владельца, а WatcherModule
 * импортирует этот модуль — обратная зависимость дала бы цикл. Класс
 * stateless, второй экземпляр ничего не стоит.
 */
import { Module } from '@nestjs/common';
import { loadAppConfig } from '../config/app-config';
import { CatalogDeliveryReleaseMetadata } from '../watcher/catalog-delivery-release-metadata.impl';
import { catalogSigningKeyOrNull } from '../watcher/signed-request.client';
import { CatalogOperatorInstallSource, NoopInstallSource } from './catalog-operator-install-source.impl';
import { FrontendCacheController } from './frontend-cache.controller';
import { FRONTEND_CACHE_DIR, FrontendCacheService } from './frontend-cache.service';
import {
  FRONTEND_INSTALL_SOURCE,
  FRONTEND_MANIFEST_VERIFIER,
  FrontendInstallSourcePort,
  FrontendManifestVerifierPort,
} from './ports';

@Module({
  controllers: [FrontendCacheController],
  providers: [
    FrontendCacheService,
    {
      provide: FRONTEND_CACHE_DIR,
      useFactory: (): string =>
        process.env.FRONTEND_CACHE_DIR ?? '/var/orchestrator/frontend-cache',
    },
    {
      provide: FRONTEND_INSTALL_SOURCE,
      useFactory: (): FrontendInstallSourcePort => {
        const baseUrl = process.env.APPS_CATALOG_OPERATOR_URL;
        const apiKey = process.env.APPS_CATALOG_OPERATOR_API_KEY;
        if (!baseUrl || !apiKey) return new NoopInstallSource();
        return new CatalogOperatorInstallSource({ baseUrl, apiKey });
      },
    },
    {
      provide: FRONTEND_MANIFEST_VERIFIER,
      useFactory: async (): Promise<FrontendManifestVerifierPort | null> => {
        const catalogDeliveryBaseUrl = process.env.CATALOG_DELIVERY_BASE_URL;
        const cfg = loadAppConfig();
        const signingKey = await catalogSigningKeyOrNull(cfg.coopname);
        if (!signingKey || !catalogDeliveryBaseUrl) return null;
        return new CatalogDeliveryReleaseMetadata({
          catalogDeliveryBaseUrl,
          coopname: cfg.coopname,
          catalogSigningKey: signingKey,
          jwtSecret: cfg.jwtSecret,
        });
      },
    },
  ],
  exports: [FrontendCacheService],
})
export class FrontendCacheModule {}
