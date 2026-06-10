import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { DataSource } from 'typeorm';
import config from '~/config/config';
import type { ITwoFactorRepository, TwoFactorRecord } from '~/domain/auth-v2/ports/two-factor.port';

/**
 * Хранилище TOTP-секретов в coop_domain_db (таблица `two_factor`, миграция V2.4.2).
 * Свой DataSource, как `PostgresVaultRepository`/`AuditService`: недоступность
 * coop-postgres бьёт только по 2FA-операциям, не по запуску coopback.
 */
@Injectable()
export class PostgresTwoFactorRepository implements ITwoFactorRepository, OnModuleDestroy {
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

  async get(subjectId: string): Promise<TwoFactorRecord | null> {
    const ds = await this.getDataSource();
    const rows: Array<{ subject_id: string; secret_enc: string; enabled: boolean }> = await ds.query(
      `SELECT subject_id, secret_enc, enabled FROM two_factor WHERE subject_id=$1`,
      [subjectId],
    );
    if (!rows.length) return null;
    const r = rows[0];
    return { subjectId: r.subject_id, secretEnc: r.secret_enc, enabled: r.enabled };
  }

  async putPending(subjectId: string, secretEnc: string): Promise<void> {
    const ds = await this.getDataSource();
    // Перевыпуск до подтверждения сбрасывает enabled и confirmed_at.
    await ds.query(
      `INSERT INTO two_factor (subject_id, secret_enc, enabled, confirmed_at)
       VALUES ($1, $2, false, NULL)
       ON CONFLICT (subject_id) DO UPDATE SET
         secret_enc = EXCLUDED.secret_enc, enabled = false, confirmed_at = NULL`,
      [subjectId, secretEnc],
    );
  }

  async enable(subjectId: string): Promise<void> {
    const ds = await this.getDataSource();
    await ds.query(`UPDATE two_factor SET enabled = true, confirmed_at = now() WHERE subject_id=$1`, [subjectId]);
  }

  async remove(subjectId: string): Promise<void> {
    const ds = await this.getDataSource();
    await ds.query(`DELETE FROM two_factor WHERE subject_id=$1`, [subjectId]);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.ds?.isInitialized) await this.ds.destroy();
  }
}
