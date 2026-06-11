import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { DataSource } from 'typeorm';
import config from '~/config/config';
import {
  type IKeyRevocationRepository,
  type KeyRevocation,
  type NewKeyRevocation,
} from '~/domain/auth-v2/ports/key-revocation.port';

interface Row {
  id: string;
  target_id: string;
  reason: string;
  revoked_by: string;
  revoked_at: Date | string;
  recovered_at: Date | string | null;
}

/**
 * Хранилище ручных отзывов ключей в coop_domain_db (таблица V2.4.10). Свой lazy
 * DataSource, как `PostgresPendingCriticalActionsRepository`.
 */
@Injectable()
export class PostgresKeyRevocationRepository implements IKeyRevocationRepository, OnModuleDestroy {
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

  async record(input: NewKeyRevocation): Promise<KeyRevocation> {
    const ds = await this.getDataSource();
    const rows: Row[] = await ds.query(
      `INSERT INTO revoked_keys (target_id, reason, revoked_by)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [input.targetId, input.reason, input.revokedBy],
    );
    return this.toDomain(rows[0]);
  }

  async findActive(targetId: string): Promise<KeyRevocation | null> {
    const ds = await this.getDataSource();
    const rows: Row[] = await ds.query(
      `SELECT * FROM revoked_keys WHERE target_id = $1 AND recovered_at IS NULL ORDER BY revoked_at DESC LIMIT 1`,
      [targetId],
    );
    return rows.length ? this.toDomain(rows[0]) : null;
  }

  async markRecovered(targetId: string): Promise<void> {
    const ds = await this.getDataSource();
    await ds.query(
      `UPDATE revoked_keys SET recovered_at = now() WHERE target_id = $1 AND recovered_at IS NULL`,
      [targetId],
    );
  }

  async onModuleDestroy(): Promise<void> {
    if (this.ds?.isInitialized) await this.ds.destroy();
  }

  private toDomain(row: Row): KeyRevocation {
    return {
      id: row.id,
      targetId: row.target_id,
      reason: row.reason,
      revokedBy: row.revoked_by,
      revokedAt: new Date(row.revoked_at).toISOString(),
      recoveredAt: row.recovered_at ? new Date(row.recovered_at).toISOString() : null,
    };
  }
}
