/**
 * @fileoverview Nest-модуль кэша фронт-частей расширений (E12-2).
 *
 * Конфигурация через ENV (все опциональны — degraded mode без каталога):
 *
 *  - `APPS_CATALOG_URL` + `APPS_CATALOG_API_KEY` — ca-admin контура
 *    (те же имена, что у coopback-прокси); без них источник Noop —
 *    кэш живёт на том, что уже на диске;
 *  - `FRONTEND_CACHE_DIR` — каталог volume-кэша
 *    (default `/var/orchestrator/frontend-cache`);
 *  - `COOPERATIVE_WIF` + `CA_AUTH_BASE_URL` — включают независимую
 *    sha256-сверку с манифестом в ca-auth registry (тот же signed-request
 *    канал, что у auto-install watcher'а); без них принимаем по
 *    заголовку ca-admin.
 *
 * Свой экземпляр {@link CaAuthReleaseMetadata} (а не общий с WatcherModule):
 * Nest резолвит провайдеры в scope модуля-владельца, а WatcherModule
 * импортирует этот модуль — обратная зависимость дала бы цикл. Класс
 * stateless, второй экземпляр ничего не стоит.
 */
import { Module } from '@nestjs/common';
import { loadAppConfig } from '../config/app-config';
import { CaAuthReleaseMetadata } from '../watcher/ca-auth-release-metadata.impl';
import { CaAdminInstallSource, NoopInstallSource } from './ca-admin-install-source.impl';
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
        const baseUrl = process.env.APPS_CATALOG_URL;
        const apiKey = process.env.APPS_CATALOG_API_KEY;
        if (!baseUrl || !apiKey) return new NoopInstallSource();
        return new CaAdminInstallSource({ baseUrl, apiKey });
      },
    },
    {
      provide: FRONTEND_MANIFEST_VERIFIER,
      useFactory: (): FrontendManifestVerifierPort | null => {
        const wif = process.env.COOPERATIVE_WIF;
        const caAuthBaseUrl = process.env.CA_AUTH_BASE_URL;
        if (!wif || !caAuthBaseUrl) return null;
        const cfg = loadAppConfig();
        return new CaAuthReleaseMetadata({
          caAuthBaseUrl,
          coopname: cfg.coopname,
          cooperativeWif: wif,
          jwtSecret: cfg.jwtSecret,
        });
      },
    },
  ],
  exports: [FrontendCacheService],
})
export class FrontendCacheModule {}
