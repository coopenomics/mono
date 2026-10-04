import { Inject, Injectable } from '@nestjs/common';
import { COOP_DOMAIN_DATABASE, type ICoopDomainDatabase } from '~/domain/auth-v2/ports/coop-domain-database.port';
import type { ITwoFactorRepository, TwoFactorRecord } from '~/domain/auth-v2/ports/two-factor.port';

/**
 * Хранилище TOTP-секретов в coop_domain_db (таблица `two_factor`, миграция V2.4.2).
 * Общее соединение базы CoopID (`CoopDomainDatabase`): недоступность
 * coop-postgres бьёт только по 2FA-операциям, не по запуску coopback.
 */
@Injectable()
export class PostgresTwoFactorRepository implements ITwoFactorRepository {
  constructor(@Inject(COOP_DOMAIN_DATABASE) private readonly db: ICoopDomainDatabase) {}

  async get(subjectId: string): Promise<TwoFactorRecord | null> {
    const rows: Array<{ subject_id: string; secret_enc: string; enabled: boolean }> = await this.db.query(
      `SELECT subject_id, secret_enc, enabled FROM two_factor WHERE subject_id=$1`,
      [subjectId],
    );
    if (!rows.length) return null;
    const r = rows[0];
    return { subjectId: r.subject_id, secretEnc: r.secret_enc, enabled: r.enabled };
  }

  async putPending(subjectId: string, secretEnc: string): Promise<void> {
    // Перевыпуск до подтверждения сбрасывает enabled и confirmed_at.
    await this.db.query(
      `INSERT INTO two_factor (subject_id, secret_enc, enabled, confirmed_at)
       VALUES ($1, $2, false, NULL)
       ON CONFLICT (subject_id) DO UPDATE SET
         secret_enc = EXCLUDED.secret_enc, enabled = false, confirmed_at = NULL, last_used_step = NULL`,
      [subjectId, secretEnc],
    );
  }

  async enable(subjectId: string): Promise<void> {
    await this.db.query(`UPDATE two_factor SET enabled = true, confirmed_at = now() WHERE subject_id=$1`, [subjectId]);
  }

  async claimStep(subjectId: string, step: number): Promise<boolean> {
    // Одним условным UPDATE: два одновременных запроса с одним кодом не пройдут оба.
    const claimed = await this.db.query(
      `UPDATE two_factor SET last_used_step = $2
       WHERE subject_id = $1 AND (last_used_step IS NULL OR last_used_step < $2)
       RETURNING subject_id`,
      [subjectId, step],
    );
    return claimed.length > 0;
  }

  async remove(subjectId: string): Promise<void> {
    await this.db.query(`DELETE FROM two_factor WHERE subject_id=$1`, [subjectId]);
  }
}
