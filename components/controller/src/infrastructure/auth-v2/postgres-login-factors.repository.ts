import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { DataSource } from 'typeorm';
import config from '~/config/config';
import type { ILoginFactorsRepository, LoginFactorsRecord } from '~/domain/auth-v2/ports/login-factors.port';

/**
 * Хранилище настроек 2FA-входа в coop_domain_db (таблица `login_factors`,
 * миграция V2.4.13). Свой DataSource, как у `PostgresTwoFactorRepository`:
 * недоступность coop-postgres бьёт только по операциям 2FA, не по старту coopback.
 */
@Injectable()
export class PostgresLoginFactorsRepository implements ILoginFactorsRepository, OnModuleDestroy {
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

  async get(subjectId: string): Promise<LoginFactorsRecord | null> {
    const ds = await this.getDataSource();
    const rows: Array<{ subject_id: string; totp_enabled: boolean; email_enabled: boolean }> = await ds.query(
      `SELECT subject_id, totp_enabled, email_enabled FROM login_factors WHERE subject_id=$1`,
      [subjectId],
    );
    if (!rows.length) return null;
    const r = rows[0];
    return { subjectId: r.subject_id, totpEnabled: r.totp_enabled, emailEnabled: r.email_enabled };
  }

  async set(record: LoginFactorsRecord): Promise<void> {
    const ds = await this.getDataSource();
    await ds.query(
      `INSERT INTO login_factors (subject_id, totp_enabled, email_enabled, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (subject_id) DO UPDATE SET
         totp_enabled = EXCLUDED.totp_enabled, email_enabled = EXCLUDED.email_enabled, updated_at = now()`,
      [record.subjectId, record.totpEnabled, record.emailEnabled],
    );
  }

  async onModuleDestroy(): Promise<void> {
    if (this.ds?.isInitialized) await this.ds.destroy();
  }
}
