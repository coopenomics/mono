import { Inject, Injectable } from '@nestjs/common';
import { COOP_DOMAIN_DATABASE, type ICoopDomainDatabase } from '~/domain/auth-v2/ports/coop-domain-database.port';
import type { IOfflineRecoveryCodeRepository } from '~/domain/auth-v2/ports/offline-recovery-code.port';

/**
 * Хранилище offline-кодов восстановления в coop_domain_db (таблица
 * `offline_recovery_code`, миграция V2.4.3). Общее соединение базы CoopID (`CoopDomainDatabase`): недоступность
 * coop-postgres бьёт только по offline-recovery, не по запуску coopback.
 */
@Injectable()
export class PostgresOfflineRecoveryCodeRepository implements IOfflineRecoveryCodeRepository {
  constructor(@Inject(COOP_DOMAIN_DATABASE) private readonly db: ICoopDomainDatabase) {}

  async findSubjectByCodeHash(codeHash: string): Promise<string | null> {
    const rows: Array<{ subject_id: string }> = await this.db.query(
      `SELECT subject_id FROM offline_recovery_code WHERE code_hash=$1`,
      [codeHash],
    );
    return rows.length ? rows[0].subject_id : null;
  }

  async set(subjectId: string, codeHash: string): Promise<void> {
    await this.db.query(
      `INSERT INTO offline_recovery_code (subject_id, code_hash, created_at)
       VALUES ($1, $2, now())
       ON CONFLICT (subject_id) DO UPDATE SET code_hash = EXCLUDED.code_hash, created_at = now()`,
      [subjectId, codeHash],
    );
  }

  async consume(subjectId: string): Promise<void> {
    await this.db.query(`DELETE FROM offline_recovery_code WHERE subject_id=$1`, [subjectId]);
  }
}
