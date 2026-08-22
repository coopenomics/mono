import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { DataSource } from 'typeorm';
import config from '~/config/config';
import type { IRecoveryStrategyRepository } from '~/domain/auth-v2/ports/recovery-strategy.port';
import { isRecoveryStrategy } from '~/domain/auth-v2/recovery-strategy/recovery-strategy.types';
import type { RecoveryStrategy } from '~/domain/auth-v2/recovery-strategy/recovery-strategy.types';

/**
 * Хранилище recovery-стратегии в coop_domain_db (таблица `recovery_strategy`,
 * миграция V2.4.4). Свой DataSource, как `PostgresVaultRepository`/2FA-repo.
 */
@Injectable()
export class PostgresRecoveryStrategyRepository implements IRecoveryStrategyRepository, OnModuleDestroy {
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

  async get(subjectId: string): Promise<RecoveryStrategy | null> {
    const ds = await this.getDataSource();
    const rows: Array<{ strategy: string }> = await ds.query(
      `SELECT strategy FROM recovery_strategy WHERE subject_id=$1`,
      [subjectId],
    );
    if (!rows.length) return null;
    // Защита от мусора в БД: невалидное значение трактуем как «не задано» (дефолт на уровне сервиса).
    return isRecoveryStrategy(rows[0].strategy) ? rows[0].strategy : null;
  }

  async set(subjectId: string, strategy: RecoveryStrategy): Promise<void> {
    const ds = await this.getDataSource();
    await ds.query(
      `INSERT INTO recovery_strategy (subject_id, strategy, updated_at)
       VALUES ($1, $2, now())
       ON CONFLICT (subject_id) DO UPDATE SET strategy = EXCLUDED.strategy, updated_at = now()`,
      [subjectId, strategy],
    );
  }

  async onModuleDestroy(): Promise<void> {
    if (this.ds?.isInitialized) await this.ds.destroy();
  }
}
