import { Inject, Injectable } from '@nestjs/common';
import { COOP_DOMAIN_DATABASE, type ICoopDomainDatabase } from '~/domain/auth-v2/ports/coop-domain-database.port';
import type { ICoopSettingsRepository } from '~/domain/auth-v2/ports/coop-settings.port';

/**
 * Настройки кооператива в coop_domain_db (таблица `coop_settings`, singleton `id=1`,
 * миграция V2.4.6). Общее соединение базы CoopID (`CoopDomainDatabase`).
 * Пределы/дефолты TTL применяет `CertSettingsService` — репозиторий лишь хранит сырое значение.
 */
@Injectable()
export class PostgresCoopSettingsRepository implements ICoopSettingsRepository {
  constructor(@Inject(COOP_DOMAIN_DATABASE) private readonly db: ICoopDomainDatabase) {}

  async getCertTtlSeconds(): Promise<number | null> {
    const rows: Array<{ cert_ttl_seconds: number | string }> = await this.db.query(
      `SELECT cert_ttl_seconds FROM coop_settings WHERE id = 1`,
    );
    if (!rows.length) return null;
    const value = Number(rows[0].cert_ttl_seconds);
    return Number.isFinite(value) ? value : null;
  }

  async setCertTtlSeconds(seconds: number): Promise<void> {
    await this.db.query(
      `INSERT INTO coop_settings (id, cert_ttl_seconds, updated_at)
       VALUES (1, $1, now())
       ON CONFLICT (id) DO UPDATE SET cert_ttl_seconds = EXCLUDED.cert_ttl_seconds, updated_at = now()`,
      [seconds],
    );
  }
}
