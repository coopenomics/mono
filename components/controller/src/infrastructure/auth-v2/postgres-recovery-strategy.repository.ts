import { Inject, Injectable } from '@nestjs/common';
import { COOP_DOMAIN_DATABASE, type ICoopDomainDatabase } from '~/domain/auth-v2/ports/coop-domain-database.port';
import type { IRecoveryStrategyRepository } from '~/domain/auth-v2/ports/recovery-strategy.port';
import { isRecoveryStrategy } from '~/domain/auth-v2/recovery-strategy/recovery-strategy.types';
import type { RecoveryStrategy } from '~/domain/auth-v2/recovery-strategy/recovery-strategy.types';

/**
 * Хранилище recovery-стратегии в coop_domain_db (таблица `recovery_strategy`,
 * миграция V2.4.4). Общее соединение базы CoopID (`CoopDomainDatabase`).
 */
@Injectable()
export class PostgresRecoveryStrategyRepository implements IRecoveryStrategyRepository {
  constructor(@Inject(COOP_DOMAIN_DATABASE) private readonly db: ICoopDomainDatabase) {}

  async get(subjectId: string): Promise<RecoveryStrategy | null> {
    const rows: Array<{ strategy: string }> = await this.db.query(
      `SELECT strategy FROM recovery_strategy WHERE subject_id=$1`,
      [subjectId],
    );
    if (!rows.length) return null;
    // Защита от мусора в БД: невалидное значение трактуем как «не задано» (дефолт на уровне сервиса).
    return isRecoveryStrategy(rows[0].strategy) ? rows[0].strategy : null;
  }

  async set(subjectId: string, strategy: RecoveryStrategy): Promise<void> {
    await this.db.query(
      `INSERT INTO recovery_strategy (subject_id, strategy, updated_at)
       VALUES ($1, $2, now())
       ON CONFLICT (subject_id) DO UPDATE SET strategy = EXCLUDED.strategy, updated_at = now()`,
      [subjectId, strategy],
    );
  }
}
