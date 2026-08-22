import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { DataSource } from 'typeorm';
import config from '~/config/config';
import type { ICoopSettingsRepository } from '~/domain/auth-v2/ports/coop-settings.port';

/**
 * Настройки кооператива в coop_domain_db (таблица `coop_settings`, singleton `id=1`,
 * миграция V2.4.6). Свой DataSource, как `PostgresVerificationRuleRepository`.
 * Пределы/дефолты TTL применяет `CertSettingsService` — репозиторий лишь хранит сырое значение.
 */
@Injectable()
export class PostgresCoopSettingsRepository implements ICoopSettingsRepository, OnModuleDestroy {
  private ds: DataSource | null = null;
  private initializing: Promise<DataSource> | null = null;

  private getDataSource(): Promise<DataSource> {
    if (this.ds?.isInitialized) return Promise.resolve(this.ds);
    if (!this.initializing) {
      this.initializing = new DataSource({
        type: 'postgres',
        host: config.coopDomainDb.host,
        port: config.coopDomainDb.port,
        username: config.coopDomainDb.username,
        password: config.coopDomainDb.password,
        database: config.coopDomainDb.database,
      })
        .initialize()
        .then((ds) => {
          this.ds = ds;
          return ds;
        })
        .finally(() => {
          this.initializing = null;
        });
    }
    return this.initializing;
  }

  async getCertTtlSeconds(): Promise<number | null> {
    const ds = await this.getDataSource();
    const rows: Array<{ cert_ttl_seconds: number | string }> = await ds.query(
      `SELECT cert_ttl_seconds FROM coop_settings WHERE id = 1`,
    );
    if (!rows.length) return null;
    const value = Number(rows[0].cert_ttl_seconds);
    return Number.isFinite(value) ? value : null;
  }

  async setCertTtlSeconds(seconds: number): Promise<void> {
    const ds = await this.getDataSource();
    await ds.query(
      `INSERT INTO coop_settings (id, cert_ttl_seconds, updated_at)
       VALUES (1, $1, now())
       ON CONFLICT (id) DO UPDATE SET cert_ttl_seconds = EXCLUDED.cert_ttl_seconds, updated_at = now()`,
      [seconds],
    );
  }

  async onModuleDestroy(): Promise<void> {
    if (this.ds?.isInitialized) await this.ds.destroy();
  }
}
