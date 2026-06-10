/**
 * @fileoverview WatcherModule — DI-проводка on-chain watcher'а (Story 10.5/10.5b).
 *
 * Реальные impl'ы портов включаются конфигурацией:
 *
 *  - `CHAIN_RPC_URL` задан → {@link ChainRpcAppsEventStream} поллит таблицы
 *    apps-контракта (releases/subs/packages) через nodeos get_table_rows
 *    и синтезирует события; иначе — Noop (watcher молчит).
 *  - `COOPERATIVE_WIF` + `CA_AUTH_BASE_URL` заданы → {@link CaAuthReleaseMetadata}
 *    достаёт install-spec из npm-манифеста в CA-auth registry по
 *    signed-request + per-package JWT; иначе — Noop (install-spec взять
 *    неоткуда, auto-install отключён).
 *
 * Так dev-стенд без каталога стартует без ошибок, а полный стенд получает
 * автоматический pipeline «подписка/релиз on-chain → docker pull → run →
 * healthcheck → registry → supergraph recompose» без ручных вызовов.
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
import { ChainRpcAppsEventStream } from './chain-rpc-event-stream.impl';
import { CaAuthReleaseMetadata } from './ca-auth-release-metadata.impl';

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
    {
      provide: APPS_CONTRACT_EVENT_STREAM,
      useFactory: (): AppsContractEventStreamPort => {
        const rpcUrl = process.env.CHAIN_RPC_URL;
        if (!rpcUrl) return new NoopEventStream();
        const cfg = loadAppConfig();
        return new ChainRpcAppsEventStream({
          rpcUrl,
          contractAccount: process.env.APPS_CONTRACT_ACCOUNT ?? 'apps',
          coopname: cfg.coopname,
          pollIntervalMs: Number(process.env.WATCHER_POLL_INTERVAL_MS ?? 15000),
        });
      },
    },
    {
      provide: RELEASE_METADATA_PORT,
      useFactory: (): ReleaseMetadataPort => {
        const wif = process.env.COOPERATIVE_WIF;
        const caAuthBaseUrl = process.env.CA_AUTH_BASE_URL;
        if (!wif || !caAuthBaseUrl) return new NoopReleaseMetadata();
        const cfg = loadAppConfig();
        return new CaAuthReleaseMetadata({
          caAuthBaseUrl,
          coopname: cfg.coopname,
          cooperativeWif: wif,
          jwtSecret: cfg.jwtSecret,
          extensionsNetwork: process.env.EXTENSIONS_DOCKER_NETWORK,
        });
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
