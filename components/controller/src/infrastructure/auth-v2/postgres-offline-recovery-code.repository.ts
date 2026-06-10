import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { DataSource } from 'typeorm';
import config from '~/config/config';
import type { IOfflineRecoveryCodeRepository } from '~/domain/auth-v2/ports/offline-recovery-code.port';

/**
 * Хранилище offline-кодов восстановления в coop_domain_db (таблица
 * `offline_recovery_code`, миграция V2.4.3). Свой DataSource, как
 * `PostgresVaultRepository`/`PostgresTwoFactorRepository`: недоступность
 * coop-postgres бьёт только по offline-recovery, не по запуску coopback.
 */
@Injectable()
export class PostgresOfflineRecoveryCodeRepository implements IOfflineRecoveryCodeRepository, OnModuleDestroy {
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

  async findSubjectByCodeHash(codeHash: string): Promise<string | null> {
    const ds = await this.getDataSource();
    const rows: Array<{ subject_id: string }> = await ds.query(
      `SELECT subject_id FROM offline_recovery_code WHERE code_hash=$1`,
      [codeHash],
    );
    return rows.length ? rows[0].subject_id : null;
  }

  async set(subjectId: string, codeHash: string): Promise<void> {
    const ds = await this.getDataSource();
    await ds.query(
      `INSERT INTO offline_recovery_code (subject_id, code_hash, created_at)
       VALUES ($1, $2, now())
       ON CONFLICT (subject_id) DO UPDATE SET code_hash = EXCLUDED.code_hash, created_at = now()`,
      [subjectId, codeHash],
    );
  }

  async consume(subjectId: string): Promise<void> {
    const ds = await this.getDataSource();
    await ds.query(`DELETE FROM offline_recovery_code WHERE subject_id=$1`, [subjectId]);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.ds?.isInitialized) await this.ds.destroy();
  }
}
