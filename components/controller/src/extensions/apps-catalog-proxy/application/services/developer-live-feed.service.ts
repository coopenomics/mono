import { Inject, Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { platformSettings, type TableStore } from '@coopenomics/extension-kit';
import { CHAIN_CHANGES_PORT, type IChainChangesPort } from '@coopenomics/innercoop';
import { APPS_PUBLISHER_STORE } from '../../infrastructure/database/apps-catalog-proxy-stores';
import type { AppsPublisherRecord } from '../../infrastructure/records/apps-publisher.record';
import { AppsCatalogHttpService } from '../../infrastructure/apps-catalog-http.service';

/** Пространство ленты для таблиц столов разработчика и администратора каталога. */
export const DEVELOPER_LIVE_CODE = 'developer';

/**
 * Таблицы ленты столов каталога (487-37). Две — настоящие таблицы базы узла:
 * сигнал по ним слой базы публикует сам после записи. Остальные — данные каталога
 * приложений, их в базе узла нет: сигнал шлёт этот сервис после мутации узла
 * и по опросу каталога.
 */
export const DEVELOPER_LIVE_TABLES = {
  /** Назначения издателей — база узла. */
  publishers: 'apps_publishers',
  /** Согласия председателя на права ядра — база узла. */
  rightsConsents: 'apps_rights_consents',
  /** Пакеты кооператива в каталоге: цена, первый выпуск, действующая версия. */
  packages: 'apps_catalog_packages',
  /** Ключи API издателя — личная таблица. */
  keys: 'apps_publisher_keys',
  /** Заявки на модерацию — только на узле оператора каталога. */
  moderation: 'apps_catalog_moderation',
} as const;

/** Каталог узлу событий не присылает: узел сверяет его состояние с таким шагом. */
const CATALOG_POLL_MS = 20_000;

/**
 * Живое обновление столов каталога через ленту ядра (487-37). Подписки
 * приложений мимо ядра — отдельная задача; до неё лента ядра единая для всех
 * экранов узла.
 */
@Injectable()
export class DeveloperLiveFeedService implements OnModuleInit {
  private readonly logger = new Logger(DeveloperLiveFeedService.name);
  /** Последний снимок пакетов каталога: пакет → отпечаток цены и выпуска. */
  private packagesSnapshot: Map<string, string> | null = null;
  /** Последний снимок очереди модерации; `null` — ещё не читали. */
  private moderationSnapshot: string | null = null;
  private polling = false;

  constructor(
    @Inject(APPS_PUBLISHER_STORE) private readonly publishers: TableStore<AppsPublisherRecord>,
    private readonly catalog: AppsCatalogHttpService,
    @Optional() @Inject(CHAIN_CHANGES_PORT) private readonly chainChanges: IChainChangesPort | null = null,
  ) {}

  onModuleInit(): void {
    this.chainChanges?.declareLocalTables([
      { code: DEVELOPER_LIVE_CODE, table: DEVELOPER_LIVE_TABLES.publishers, owner_field: 'username' },
      { code: DEVELOPER_LIVE_CODE, table: DEVELOPER_LIVE_TABLES.rightsConsents },
      { code: DEVELOPER_LIVE_CODE, table: DEVELOPER_LIVE_TABLES.packages },
      { code: DEVELOPER_LIVE_CODE, table: DEVELOPER_LIVE_TABLES.keys, owner_field: 'username' },
      { code: DEVELOPER_LIVE_CODE, table: DEVELOPER_LIVE_TABLES.moderation, staff_only: true },
    ]);
  }

  /** Цена либо выпуск пакета изменились. */
  packageChanged(packageId: string): Promise<void> {
    return this.signal(DEVELOPER_LIVE_TABLES.packages, packageId);
  }

  /** Ключи API издателя изменились. */
  keysChanged(username: string): Promise<void> {
    return this.signal(DEVELOPER_LIVE_TABLES.keys, username, { username });
  }

  /** Очередь модерации изменилась. */
  moderationChanged(id: string): Promise<void> {
    return this.signal(DEVELOPER_LIVE_TABLES.moderation, id);
  }

  /**
   * Сверка с каталогом: решение модератора, выпуск из терминала и подача
   * выпуска проходят мимо узла издателя. Изменившийся пакет и изменившаяся
   * очередь модерации получают сигнал. Первый проход только снимает снимок.
   */
  @Interval(CATALOG_POLL_MS) // timing: schedule — каталог не присылает узлу событий, состояние пакетов сверяется опросом
  async pollCatalog(): Promise<void> {
    if (this.polling || !this.chainChanges) return;
    this.polling = true;
    try {
      await this.pollPackages();
      await this.pollModeration();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.debug(`сверка с каталогом пропущена: ${msg}`);
    } finally {
      this.polling = false;
    }
  }

  private async pollPackages(): Promise<void> {
    const registered = await this.publishers.find({ coopname: platformSettings().coopname });
    if (registered.length === 0) return;
    const rows = await this.catalog.listDeveloperPricing([...new Set(registered.map((r) => r.packageId))]);
    const next = new Map(
      rows.map((r) => [r.packageId, JSON.stringify([r.rubPerMonth, r.trialDays, r.lastActiveVersion, r.inCatalog])]),
    );
    const previous = this.packagesSnapshot;
    this.packagesSnapshot = next;
    if (!previous) return;
    const ids = new Set([...previous.keys(), ...next.keys()]);
    for (const id of ids) {
      if (previous.get(id) !== next.get(id)) await this.packageChanged(id);
    }
  }

  private async pollModeration(): Promise<void> {
    if (!this.catalog.hasOperatorAccess) return;
    const items = await this.catalog.listSubmittedModerations('SUBMITTED', 100);
    const next = items.map((m) => `${m.id}:${m.status}`).sort().join(',');
    const previous = this.moderationSnapshot;
    this.moderationSnapshot = next;
    if (previous !== null && previous !== next) await this.moderationChanged('queue');
  }

  private async signal(table: string, key: string, row?: Record<string, unknown>): Promise<void> {
    if (!this.chainChanges) return;
    try {
      await this.chainChanges.publishLocal(table, key, row);
    } catch {
      // Сигнал — подсказка «перечитай», не данные: без него экран догонит следующим сигналом.
    }
  }
}
