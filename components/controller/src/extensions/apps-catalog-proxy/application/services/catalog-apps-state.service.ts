/**
 * Состояние приложений каталога на узле: включено ли приложение и его
 * настройки (таблица `apps_catalog_apps`). Подписка живёт у провайдера,
 * фронт — в кэше оркестратора; здесь — только то, что решает сам узел, по
 * тем же правилам, что у встроенных расширений: установленное приложение
 * можно выключить, не отменяя подписку, и включить снова.
 */
import { Inject, Injectable } from '@nestjs/common';
import type { TableStore } from '@coopenomics/extension-kit';
import { CATALOG_APP_STORE } from '../../infrastructure/database/apps-catalog-proxy-stores';
import { CatalogAppRecord } from '../../infrastructure/records/catalog-app.record';

@Injectable()
export class CatalogAppsStateService {
  constructor(
    @Inject(CATALOG_APP_STORE)
    private readonly store: TableStore<CatalogAppRecord>,
  ) {}

  /** Состояние всех приложений, о которых узел знает. */
  list(): Promise<CatalogAppRecord[]> {
    return this.store.find({});
  }

  /** Состояние пакета; нет строки — приложение не подключалось на этом узле. */
  get(packageId: string): Promise<CatalogAppRecord | null> {
    return this.store.findOne({ packageId });
  }

  /** Включено ли приложение; без строки считается включённым: подписка есть — приложение работает. */
  async isEnabled(packageId: string): Promise<boolean> {
    const row = await this.store.findOne({ packageId });
    return row ? row.enabled : true;
  }

  /** Пакеты, выключенные на узле: их фронт рабочему столу не отдаётся. */
  async disabledPackageIds(): Promise<Set<string>> {
    const rows = await this.store.find({ enabled: false });
    return new Set(rows.map((r) => r.packageId));
  }

  /** Подписка оформлена — приложение включено и готово к настройке. */
  async markSubscribed(packageId: string): Promise<CatalogAppRecord> {
    const existing = await this.store.findOne({ packageId });
    if (existing) {
      if (!existing.enabled) await this.store.update({ packageId }, { enabled: true, updatedAt: new Date() });
      return { ...existing, enabled: true };
    }
    return this.store.insert({ packageId, enabled: true, config: {}, updatedAt: new Date() });
  }

  async setEnabled(packageId: string, enabled: boolean): Promise<CatalogAppRecord> {
    const existing = await this.store.findOne({ packageId });
    if (!existing) return this.store.insert({ packageId, enabled, config: {}, updatedAt: new Date() });
    await this.store.update({ packageId }, { enabled, updatedAt: new Date() });
    return { ...existing, enabled };
  }

  async setConfig(packageId: string, config: Record<string, unknown>): Promise<CatalogAppRecord> {
    const existing = await this.store.findOne({ packageId });
    if (!existing) return this.store.insert({ packageId, enabled: true, config, updatedAt: new Date() });
    await this.store.update({ packageId }, { config, updatedAt: new Date() });
    return { ...existing, config };
  }
}
