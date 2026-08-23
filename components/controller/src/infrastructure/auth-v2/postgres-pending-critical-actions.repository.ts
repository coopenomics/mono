import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { DataSource } from 'typeorm';
import config from '~/config/config';
import {
  CriticalActionStatus,
  CriticalActionType,
  type CriticalActionConfirmation,
  type IPendingCriticalActionsRepository,
  type NewCriticalAction,
  type PendingCriticalAction,
} from '~/domain/auth-v2/ports/pending-critical-actions.port';

interface Row {
  id: string;
  action_type: string;
  actor_id: string;
  target_id: string;
  payload: Record<string, unknown>;
  status: string;
  confirmations: CriticalActionConfirmation[];
  created_at: Date | string;
  expires_at: Date | string;
  finalized_at: Date | string | null;
}

/**
 * Хранилище pending critical actions в coop_domain_db (таблица V2.4.9). Свой lazy
 * DataSource, как `PostgresAccessRulesRepository`. enum-поля санитизируются к домену.
 */
@Injectable()
export class PostgresPendingCriticalActionsRepository implements IPendingCriticalActionsRepository, OnModuleDestroy {
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

  async create(input: NewCriticalAction): Promise<PendingCriticalAction> {
    const ds = await this.getDataSource();
    const rows: Row[] = await ds.query(
      `INSERT INTO pending_critical_actions (action_type, actor_id, target_id, payload, status, confirmations, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        input.actionType,
        input.actorId,
        input.targetId,
        JSON.stringify(input.payload),
        CriticalActionStatus.Pending,
        JSON.stringify(input.confirmations),
        input.expiresAt,
      ],
    );
    return this.toDomain(rows[0]);
  }

  async findById(id: string): Promise<PendingCriticalAction | null> {
    const ds = await this.getDataSource();
    const rows: Row[] = await ds.query(`SELECT * FROM pending_critical_actions WHERE id = $1`, [id]);
    return rows.length ? this.toDomain(rows[0]) : null;
  }

  async update(action: PendingCriticalAction): Promise<void> {
    const ds = await this.getDataSource();
    await ds.query(
      `UPDATE pending_critical_actions
       SET confirmations = $2, status = $3, finalized_at = $4
       WHERE id = $1`,
      [action.id, JSON.stringify(action.confirmations), action.status, action.finalizedAt ?? null],
    );
  }

  async listExpired(nowIso: string): Promise<PendingCriticalAction[]> {
    const ds = await this.getDataSource();
    const rows: Row[] = await ds.query(
      `SELECT * FROM pending_critical_actions WHERE status = $1 AND expires_at <= $2`,
      [CriticalActionStatus.Pending, nowIso],
    );
    return rows.map((r) => this.toDomain(r));
  }

  async listByTarget(targetId: string): Promise<PendingCriticalAction[]> {
    const ds = await this.getDataSource();
    const rows: Row[] = await ds.query(
      `SELECT * FROM pending_critical_actions WHERE target_id = $1 ORDER BY created_at DESC`,
      [targetId],
    );
    return rows.map((r) => this.toDomain(r));
  }

  async onModuleDestroy(): Promise<void> {
    if (this.ds?.isInitialized) await this.ds.destroy();
  }

  private toDomain(row: Row): PendingCriticalAction {
    return {
      id: row.id,
      actionType: this.toType(row.action_type),
      actorId: row.actor_id,
      targetId: row.target_id,
      payload: row.payload ?? {},
      status: this.toStatus(row.status),
      confirmations: Array.isArray(row.confirmations) ? row.confirmations : [],
      createdAt: new Date(row.created_at).toISOString(),
      expiresAt: new Date(row.expires_at).toISOString(),
      finalizedAt: row.finalized_at ? new Date(row.finalized_at).toISOString() : null,
    };
  }

  private toType(value: string): CriticalActionType {
    return (Object.values(CriticalActionType) as string[]).includes(value)
      ? (value as CriticalActionType)
      : CriticalActionType.ExcludeParticipant;
  }

  private toStatus(value: string): CriticalActionStatus {
    return (Object.values(CriticalActionStatus) as string[]).includes(value)
      ? (value as CriticalActionStatus)
      : CriticalActionStatus.Pending;
  }
}
