import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { DataSource } from 'typeorm';
import config from '~/config/config';

export type AuditResult = 'success' | 'failure' | 'degraded' | 'pending';

export interface AuditRecord {
  event: string;
  subjectId?: string | null;
  actor?: string | null;
  result: AuditResult;
  context?: Record<string, unknown>;
  ip?: string | null;
  /**
   * User-Agent инициатора (форензика, Story 8.2). Первоклассная колонка `user_agent`
   * (миграция V2.4.11). Отсутствует → null; причину отсутствия (internal call и т.п.)
   * вызывающий ставит флагом в `context` (конвенция explicit-null-with-reason,
   * docs/audit/event-schema.md), сам сервис её не домысливает.
   */
  userAgent?: string | null;
}

/** Ключи, которым нечего делать в audit-контексте ни на каком уровне вложенности. */
const SECRET_KEY_PATTERNS = ['password', 'private_key', 'token', 'secret', 'signature'];

/**
 * Blacklist-инвариант аудита (архитектура CoopID): попытка записать секрет
 * в context — программная ошибка, бросаем сразу, а не маскируем.
 */
export function assertContextHasNoSecrets(context: Record<string, unknown>, path = ''): void {
  for (const [key, value] of Object.entries(context)) {
    const lower = key.toLowerCase();
    if (SECRET_KEY_PATTERNS.some((p) => lower.includes(p)))
      throw new Error(`AuditService: ключ «${path}${key}» похож на секрет — запись в audit_events запрещена`);
    if (value && typeof value === 'object' && !Array.isArray(value))
      assertContextHasNoSecrets(value as Record<string, unknown>, `${path}${key}.`);
  }
}

/**
 * Запись в append-only audit_events (coop_domain_db). Подключение ленивое:
 * coop-postgres недоступен → ошибка только у вызывающего, запуск coopback
 * не зависит от этого сервиса.
 */
@Injectable()
export class AuditService implements OnModuleDestroy {
  private readonly logger = new Logger(AuditService.name);
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

  async record(record: AuditRecord): Promise<void> {
    const context = record.context ?? {};
    assertContextHasNoSecrets(context);
    const ds = await this.getDataSource();
    await ds.query(
      `INSERT INTO audit_events (event, subject_id, actor, result, context, ip, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        record.event,
        record.subjectId ?? null,
        record.actor ?? null,
        record.result,
        JSON.stringify(context),
        record.ip ?? null,
        record.userAgent ?? null,
      ],
    );
    this.logger.log(`audit: ${record.event} subject=${record.subjectId ?? '-'} result=${record.result}`);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.ds?.isInitialized) await this.ds.destroy();
  }
}
