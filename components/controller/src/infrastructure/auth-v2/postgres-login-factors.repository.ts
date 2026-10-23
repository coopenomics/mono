import { Inject, Injectable } from '@nestjs/common';
import { COOP_DOMAIN_DATABASE, type ICoopDomainDatabase } from '~/domain/auth-v2/ports/coop-domain-database.port';
import type { ILoginFactorsRepository, LoginFactorsRecord } from '~/domain/auth-v2/ports/login-factors.port';

/**
 * Хранилище настроек 2FA-входа в coop_domain_db (таблица `login_factors`,
 * миграция V2.4.13). Общее соединение базы CoopID (`CoopDomainDatabase`):
 * недоступность coop-postgres бьёт только по операциям 2FA, не по старту coopback.
 */
@Injectable()
export class PostgresLoginFactorsRepository implements ILoginFactorsRepository {
  constructor(@Inject(COOP_DOMAIN_DATABASE) private readonly db: ICoopDomainDatabase) {}

  async get(subjectId: string): Promise<LoginFactorsRecord | null> {
    const rows: Array<{ subject_id: string; totp_enabled: boolean; email_enabled: boolean }> = await this.db.query(
      `SELECT subject_id, totp_enabled, email_enabled FROM login_factors WHERE subject_id=$1`,
      [subjectId],
    );
    if (!rows.length) return null;
    const r = rows[0];
    return { subjectId: r.subject_id, totpEnabled: r.totp_enabled, emailEnabled: r.email_enabled };
  }

  async set(record: LoginFactorsRecord): Promise<void> {
    await this.db.query(
      `INSERT INTO login_factors (subject_id, totp_enabled, email_enabled, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (subject_id) DO UPDATE SET
         totp_enabled = EXCLUDED.totp_enabled, email_enabled = EXCLUDED.email_enabled, updated_at = now()`,
      [record.subjectId, record.totpEnabled, record.emailEnabled],
    );
  }
}
