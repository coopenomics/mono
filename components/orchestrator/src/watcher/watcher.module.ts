/**
 * @fileoverview WatcherModule — DI-проводка watcher'а установки расширений.
 *
 * Источник — catalog-delivery (Архитектура v5 каталога, 487-34): контракт
 * apps выведен, подписки кооператива ведёт провайдер, каталог хранит копию.
 *
 *  - `CATALOG_DELIVERY_BASE_URL` задан → {@link CatalogDeliveryEventStream}
 *    опрашивает действующие подписки кооператива и версии их выпусков,
 *    {@link CatalogDeliveryReleaseMetadata} достаёт install-spec из
 *    npm-манифеста в registry по per-package JWT. Вход в каталог — tenant JWT,
 *    который передаёт ядро (ключ у оркестратора не хранится); пока токена нет,
 *    опрос пропускается.
 *  - адреса нет → Noop: dev-стенд без каталога стартует без ошибок.
 */
import { Module } from '@nestjs/common';
import { FrontendCacheModule } from '../frontend-cache/frontend-cache.module';
import { GatewayModule } from '../gateway/gateway.module';
import { OrchestratorModule } from '../orchestrator/orchestrator.module';
import { OnChainWatcherService, OnChainWatcherConfig } from './on-chain-watcher.service';
import {
  APPS_CONTRACT_EVENT_STREAM,
  AppsContractEvent,
  AppsContractEventStreamPort,
  RELEASE_METADATA_PORT,
  ReleaseInstallSpec,
  ReleaseMetadataPort,
} from './ports';
import { loadAppConfig } from '../config/app-config';
import { CatalogDeliveryEventStream } from './catalog-delivery-event-stream.impl';
import { CatalogDeliveryReleaseMetadata } from './catalog-delivery-release-metadata.impl';
import { CatalogTenantToken } from './catalog-tenant-token';

class NoopEventStream implements AppsContractEventStreamPort {
  async subscribe(_handler: (e: AppsContractEvent) => Promise<void>): Promise<{ unsubscribe(): void }> {
    return { unsubscribe: () => undefined };
  }
}

class NoopReleaseMetadata implements ReleaseMetadataPort {
  async fetchInstallSpec(_opts: { packageId: string; version: string }): Promise<ReleaseInstallSpec | null> {
    return null;
  }
}

@Module({
  imports: [GatewayModule, OrchestratorModule, FrontendCacheModule],
  providers: [
    OnChainWatcherService,
    {
      provide: RELEASE_METADATA_PORT,
      inject: [CatalogTenantToken],
      useFactory: (token: CatalogTenantToken): ReleaseMetadataPort => {
        const catalogDeliveryBaseUrl = process.env.CATALOG_DELIVERY_BASE_URL;
        if (!catalogDeliveryBaseUrl) return new NoopReleaseMetadata();
        const cfg = loadAppConfig();
        return new CatalogDeliveryReleaseMetadata(
          {
            catalogDeliveryBaseUrl,
            coopname: cfg.coopname,
            jwtSecret: cfg.jwtSecret,
            extensionsNetwork: process.env.EXTENSIONS_DOCKER_NETWORK,
          },
          token,
        );
      },
    },
    {
      provide: APPS_CONTRACT_EVENT_STREAM,
      inject: [CatalogTenantToken, RELEASE_METADATA_PORT],
      useFactory: (token: CatalogTenantToken, metadata: ReleaseMetadataPort): AppsContractEventStreamPort => {
        const catalogDeliveryBaseUrl = process.env.CATALOG_DELIVERY_BASE_URL;
        if (!catalogDeliveryBaseUrl || !(metadata instanceof CatalogDeliveryReleaseMetadata)) {
          return new NoopEventStream();
        }
        return new CatalogDeliveryEventStream(
          {
            catalogDeliveryBaseUrl,
            coopname: loadAppConfig().coopname,
            pollIntervalMs: Number(process.env.WATCHER_POLL_INTERVAL_MS ?? 15000),
            releasePollEvery: Number(process.env.WATCHER_RELEASE_POLL_EVERY ?? 20),
          },
          token,
          metadata,
        );
      },
    },
    {
      provide: 'ON_CHAIN_WATCHER_CONFIG',
      useFactory: (): OnChainWatcherConfig => {
        const cfg = loadAppConfig();
        return {
          coopname: cfg.coopname,
          cooperativeJwt: process.env.COOPERATIVE_JWT,
          extensionsNetwork: process.env.EXTENSIONS_DOCKER_NETWORK,
        };
      },
    },
  ],
  exports: [OnChainWatcherService],
})
export class WatcherModule {}
