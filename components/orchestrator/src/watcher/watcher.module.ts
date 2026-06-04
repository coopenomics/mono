/**
 * @fileoverview WatcherModule — DI-проводка on-chain watcher'а (Story 10.5).
 *
 * На текущий момент impl'ы портов поставляются заглушками
 * `NoopEventStream` / `NoopReleaseMetadata` — они не делают ничего.
 * Это сделано, чтобы AppModule не падал при boot'е, пока реальные
 * impl'ы (parser2 client / HTTP к apps-catalog) не приехали в
 * отдельных follow-up'ах.
 *
 * Реальная подключка чита chain'а — отдельный PR
 * (`feat/E10-5b-chain-rpc-impl`). Этот модуль фиксирует контракт.
 */
import { Module } from '@nestjs/common';
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
  imports: [GatewayModule, OrchestratorModule],
  providers: [
    OnChainWatcherService,
    { provide: APPS_CONTRACT_EVENT_STREAM, useClass: NoopEventStream },
    { provide: RELEASE_METADATA_PORT, useClass: NoopReleaseMetadata },
    {
      provide: 'ON_CHAIN_WATCHER_CONFIG',
      useFactory: (): OnChainWatcherConfig => {
        const cfg = loadAppConfig();
        return {
          coopname: cfg.coopname,
          cooperativeJwt: process.env.COOPERATIVE_JWT,
        };
      },
    },
  ],
  exports: [OnChainWatcherService],
})
export class WatcherModule {}
