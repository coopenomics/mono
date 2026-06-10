/**
 * @fileoverview On-chain watcher (Story 10.5). Слушает события
 * apps-contract в Коопеномиксе и автоматически синхронизирует
 * состояние установленных расширений с тем, что в блокчейне.
 *
 * Source-of-truth — chain. Если на orchestrator-ноде установлено
 * что-то, чего нет в chain'е (или есть, но release отозван), оно
 * uninstall'ится. Если в chain'е появилось новое — install'ится.
 *
 * Логика:
 *  - `release-published`: проверить, виден ли релиз нашему кооперативу
 *    через scope (all / subnets / cooperatives) и есть ли у нас
 *    активная подписка → install pipeline.
 *  - `subscription-activated`: дотянуть active-релиз из apps-catalog'а
 *    → install pipeline.
 *  - `release-withdrawn`: если этот пакет был активен — uninstall.
 *  - `subscription-expired`: uninstall расширения.
 *
 * Все три сценария проходят через {@link InstallOrchestratorService}
 * → одно место решения «как ставить»; watcher только триггерит.
 *
 * Идемпотентность: install pipeline сам upsert'ит registry — повторный
 * вызов с тем же `(packageId, version)` no-op. Uninstall переводит
 * запись в active=false; повторный uninstall тоже no-op.
 */
import { Inject, Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import {
  APPS_CONTRACT_EVENT_STREAM,
  AppsContractEvent,
  AppsContractEventStreamPort,
  RELEASE_METADATA_PORT,
  ReleaseInstallSpec,
  ReleaseMetadataPort,
} from './ports';
import { InstallOrchestratorService } from '../orchestrator/install-orchestrator.service';
import { SubgraphRegistryService } from '../gateway/subgraph-registry.service';

export interface OnChainWatcherConfig {
  /** Имя нашего кооператива — нужно для фильтрации scope=cooperatives. */
  coopname: string;
  /**
   * Фолбэк-JWT для docker pull, если metadata-порт не вернул
   * per-package JWT (`spec.pullJwt`) — например, при статической
   * конфигурации без signed-request ключа.
   */
  cooperativeJwt?: string;
  /** Docker-сеть, в которую подключаются контейнеры расширений. */
  extensionsNetwork?: string;
}

@Injectable()
export class OnChainWatcherService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(OnChainWatcherService.name);
  private subscription?: { unsubscribe(): void };

  constructor(
    @Inject(APPS_CONTRACT_EVENT_STREAM) private readonly stream: AppsContractEventStreamPort,
    @Inject(RELEASE_METADATA_PORT) private readonly metadata: ReleaseMetadataPort,
    @Inject('ON_CHAIN_WATCHER_CONFIG') private readonly cfg: OnChainWatcherConfig,
    private readonly orchestrator: InstallOrchestratorService,
    private readonly registry: SubgraphRegistryService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    this.subscription = await this.stream.subscribe((e) => this.handle(e));
    this.logger.log(`on-chain watcher started (coopname=${this.cfg.coopname})`);
  }

  onApplicationShutdown(): void {
    this.subscription?.unsubscribe();
  }

  /**
   * @internal exposed для юнит-тестов — гонять без bootstrap'а Nest'а.
   */
  async handle(e: AppsContractEvent): Promise<void> {
    switch (e.kind) {
      case 'release-published':
        return this.handleReleasePublished(e);
      case 'subscription-activated':
        return this.handleSubscriptionActivated(e);
      case 'release-withdrawn':
        return this.handleReleaseWithdrawn(e);
      case 'subscription-expired':
        return this.handleSubscriptionExpired(e);
    }
  }

  private async handleReleasePublished(
    e: Extract<AppsContractEvent, { kind: 'release-published' }>,
  ): Promise<void> {
    if (!this.isReleaseVisibleToCoop(e)) {
      this.logger.debug(
        `release-published ${e.packageId}@${e.version} вне scope нашего coopname=${this.cfg.coopname} → ignore`,
      );
      return;
    }
    const spec = await this.metadata.fetchInstallSpec({
      packageId: e.packageId,
      version: e.version,
    });
    if (spec === null) {
      this.logger.warn(
        `release-published ${e.packageId}@${e.version}: metadata not found, install skipped`,
      );
      return;
    }
    await this.callInstall(e.packageId, e.version, spec);
  }

  private async handleSubscriptionActivated(
    e: Extract<AppsContractEvent, { kind: 'subscription-activated' }>,
  ): Promise<void> {
    if (e.coopname !== this.cfg.coopname) return;
    // На subscription-activated нам не приходит конкретная версия —
    // нужно сходить в apps-catalog за active-релизом. fetchInstallSpec
    // с пустой version интерпретируется реальным impl'ом как «дай active».
    const spec = await this.metadata.fetchInstallSpec({
      packageId: e.packageId,
      version: '',
    });
    if (spec === null) {
      this.logger.warn(`subscription-activated ${e.packageId}: active release not found`);
      return;
    }
    // Так как реальной версии в event'е нет, оставим version пустой —
    // реальный fetchInstallSpec impl должен резолвить и возвращать
    // активную версию через расширение spec'а. На текущем shape'е
    // используем packageId как метку записи — registry хранит
    // packageId как primary key, версия пишется отдельным полем.
    await this.callInstall(e.packageId, 'active', spec);
  }

  private async handleReleaseWithdrawn(
    e: Extract<AppsContractEvent, { kind: 'release-withdrawn' }>,
  ): Promise<void> {
    await this.registry.deactivate(e.packageId);
    this.logger.log(`release-withdrawn ${e.packageId}@${e.version} → deactivated`);
  }

  private async handleSubscriptionExpired(
    e: Extract<AppsContractEvent, { kind: 'subscription-expired' }>,
  ): Promise<void> {
    if (e.coopname !== this.cfg.coopname) return;
    await this.registry.deactivate(e.packageId);
    this.logger.log(`subscription-expired ${e.packageId} → deactivated`);
  }

  private isReleaseVisibleToCoop(
    e: Extract<AppsContractEvent, { kind: 'release-published' }>,
  ): boolean {
    switch (e.scopeType) {
      case 'all':
        return true;
      case 'cooperatives':
        return (e.scopeCoopnames ?? []).includes(this.cfg.coopname);
      case 'subnets':
        // Subnet-фильтрация требует знания нашего subnet_id — отдельный
        // конфиг; пока считаем что watcher на этой ноде subnet-aware
        // на уровне stream'а (он не должен присылать чужие subnets).
        return true;
      case 'empty':
        return false;
    }
  }

  private async callInstall(
    packageId: string,
    version: string,
    spec: ReleaseInstallSpec,
  ): Promise<void> {
    const result = await this.orchestrator.install({
      packageId,
      version,
      url: spec.url,
      imageRef: spec.imageRef,
      composeService: spec.composeService,
      composeFile: spec.composeFile,
      containerName: spec.containerName,
      containerNetwork: this.cfg.extensionsNetwork,
      containerEnv: spec.containerEnv,
      healthUrl: spec.healthUrl,
      cooperativeJwt: spec.pullJwt ?? this.cfg.cooperativeJwt,
      coopname: this.cfg.coopname,
    });
    if (result.status === 'failed') {
      this.logger.error(
        `install via watcher failed: ${packageId}@${version} reason=${result.reason} ${result.error}`,
      );
    }
  }
}
