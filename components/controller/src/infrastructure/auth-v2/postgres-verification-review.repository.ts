import { rowsOf as rowsOfRaw } from './raw-query-result';
import { Inject, Injectable, OnModuleDestroy, Optional } from '@nestjs/common';
import { DataSource } from 'typeorm';
import config from '~/config/config';
import { ChainChangesService } from '~/infrastructure/blockchain/chain-changes.service';
import type {
  IVerificationReviewRepository,
  VerificationReviewDraft,
  VerificationReviewFilter,
} from '~/domain/auth-v2/ports/verification-review.port';
import {
  VerificationReviewStatus,
  type VerificationReview,
  type VerificationReviewPhoto,
} from '~/domain/auth-v2/verification/verification-review.types';

const DEFAULT_LIMIT = 200;

export interface ReviewRow {
  id: string;
  username: string;
  procedure: string;
  braname: string;
  verificator: string;
  status: VerificationReviewStatus;
  photos: VerificationReviewPhoto[] | null;
  created_at: Date;
  decided_by: string | null;
  decided_at: Date | null;
  decision_reason: string | null;
}

const VALID_STATUSES = new Set<string>(Object.values(VerificationReviewStatus));

/** Строки ответа query — общий разбор CoopID-хранилищ (raw-query-result.ts). */
export function rowsOf(raw: unknown): ReviewRow[] {
  return rowsOfRaw<ReviewRow>(raw);
}

function toReview(row: ReviewRow): VerificationReview {
  return {
    id: row.id,
    username: row.username,
    procedure: row.procedure,
    braname: row.braname ?? '',
    verificator: row.verificator,
    // Колонка — обычный text, и расхождение схемы с кодом журнал ронять не
    // должно: неизвестное значение читаем как отозванное — запись точно не в
    // работе, а значит совет её не ждёт.
    status: VALID_STATUSES.has(row.status)
      ? (row.status as VerificationReviewStatus)
      : VerificationReviewStatus.Revoked,
    photos: row.photos ?? [],
    created_at: row.created_at.toISOString(),
    decided_by: row.decided_by,
    decided_at: row.decided_at ? row.decided_at.toISOString() : null,
    decision_reason: row.decision_reason,
  };
}

/**
 * Журнал верификаций в coop_domain_db (таблица `verification_reviews`,
 * миграция V2.5.4). Свой DataSource, как `PostgresVerificationRuleRepository`.
 */
/** Имя журнала в ленте изменений — объявлен в `chain-changes.service.ts`. */
const VERIFICATION_REVIEWS_TABLE = 'verification_reviews';

@Injectable()
export class PostgresVerificationReviewRepository implements IVerificationReviewRepository, OnModuleDestroy {
  private ds: DataSource | null = null;
  private initializing: Promise<DataSource> | null = null;

  constructor(
    // Журнал живёт в отдельной базе на сыром SQL — подписчик базы узла его не
    // видит, поэтому сигнал ленты изменений публикуется здесь, после записи.
    @Optional() @Inject(ChainChangesService) private readonly feed: ChainChangesService | null = null,
  ) {}

  private signal(row: ReviewRow | undefined): void {
    if (row) void this.feed?.publishLocal(VERIFICATION_REVIEWS_TABLE, String(row.id), row as unknown as Record<string, unknown>);
  }

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

  async create(draft: VerificationReviewDraft): Promise<VerificationReview> {
    const ds = await this.getDataSource();
    const rows: ReviewRow[] = await ds.query(
      `INSERT INTO verification_reviews (id, username, procedure, braname, verificator, status, photos)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
       RETURNING *`,
      [
        draft.id,
        draft.username,
        draft.procedure,
        draft.braname,
        draft.verificator,
        draft.status,
        JSON.stringify(draft.photos ?? []),
      ],
    );
    this.signal(rows[0]);
    return toReview(rows[0]);
  }

  async findById(id: string): Promise<VerificationReview | null> {
    const ds = await this.getDataSource();
    const rows: ReviewRow[] = await ds.query(`SELECT * FROM verification_reviews WHERE id = $1`, [id]);
    return rows.length ? toReview(rows[0]) : null;
  }

  async findLatestByUsername(username: string): Promise<VerificationReview | null> {
    const ds = await this.getDataSource();
    const rows: ReviewRow[] = await ds.query(
      `SELECT * FROM verification_reviews WHERE username = $1 ORDER BY created_at DESC LIMIT 1`,
      [username],
    );
    return rows.length ? toReview(rows[0]) : null;
  }

  async list(filter: VerificationReviewFilter): Promise<VerificationReview[]> {
    const ds = await this.getDataSource();
    const where: string[] = [];
    const params: unknown[] = [];
    if (filter.status) {
      params.push(filter.status);
      where.push(`status = $${params.length}`);
    }
    if (filter.username) {
      params.push(filter.username);
      where.push(`username = $${params.length}`);
    }
    if (filter.braname) {
      params.push(filter.braname);
      where.push(`braname = $${params.length}`);
    }
    params.push(Math.min(filter.limit ?? DEFAULT_LIMIT, DEFAULT_LIMIT));
    const rows: ReviewRow[] = await ds.query(
      `SELECT * FROM verification_reviews
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY created_at DESC
       LIMIT $${params.length}`,
      params,
    );
    return rows.map(toReview);
  }

  async countByStatus(status: VerificationReviewStatus): Promise<number> {
    const ds = await this.getDataSource();
    const rows: Array<{ count: string }> = await ds.query(
      `SELECT count(*)::text AS count FROM verification_reviews WHERE status = $1`,
      [status],
    );
    return Number(rows[0]?.count ?? 0);
  }

  async decide(params: {
    id: string;
    status: VerificationReviewStatus;
    decided_by: string;
    decision_reason?: string | null;
    clear_photos: boolean;
  }): Promise<VerificationReview | null> {
    const ds = await this.getDataSource();
    const raw = await ds.query(
      `UPDATE verification_reviews
          SET status = $2,
              decided_by = $3,
              decided_at = now(),
              decision_reason = $4,
              photos = CASE WHEN $5 THEN '[]'::jsonb ELSE photos END
        WHERE id = $1
        RETURNING *`,
      [params.id, params.status, params.decided_by, params.decision_reason ?? null, params.clear_photos],
    );
    const rows = rowsOf(raw);
    this.signal(rows[0]);
    return rows.length ? toReview(rows[0]) : null;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.ds?.isInitialized) await this.ds.destroy();
  }
}
