import { Inject, Injectable } from '@nestjs/common';
import { COOP_DOMAIN_DATABASE, type ICoopDomainDatabase } from '~/domain/auth-v2/ports/coop-domain-database.port';
import type { IVerificationRuleRepository } from '~/domain/auth-v2/ports/verification-rule.port';
import { VerificationType, type VerificationRule } from '~/domain/auth-v2/verification/verification.types';

const VALID_TYPES = new Set<string>(Object.values(VerificationType));

/** Оставляем только валидные типы верификации — защита от мусора в БД (как recovery_strategy). */
function sanitizeTypes(raw: string[]): VerificationType[] {
  return raw.filter((t): t is VerificationType => VALID_TYPES.has(t));
}

/**
 * Хранилище правил верификации в coop_domain_db (таблица `verification_rules`,
 * миграция V2.4.5). Общее соединение базы CoopID (`CoopDomainDatabase`).
 * `required_types` — postgres `text[]`; невалидные значения отбрасываются на чтении.
 */
@Injectable()
export class PostgresVerificationRuleRepository implements IVerificationRuleRepository {
  constructor(@Inject(COOP_DOMAIN_DATABASE) private readonly db: ICoopDomainDatabase) {}

  async findByActionCode(actionCode: string): Promise<VerificationRule | null> {
    const rows: Array<{ required_types: string[] }> = await this.db.query(
      `SELECT required_types FROM verification_rules WHERE action_code=$1`,
      [actionCode],
    );
    if (!rows.length) return null;
    return { action_code: actionCode, required_types: sanitizeTypes(rows[0].required_types ?? []) };
  }

  async list(): Promise<VerificationRule[]> {
    const rows: Array<{ action_code: string; required_types: string[] }> = await this.db.query(
      `SELECT action_code, required_types FROM verification_rules ORDER BY action_code`,
    );
    return rows.map((r) => ({ action_code: r.action_code, required_types: sanitizeTypes(r.required_types ?? []) }));
  }

  async upsert(rule: VerificationRule): Promise<void> {
    await this.db.query(
      `INSERT INTO verification_rules (action_code, required_types, updated_at)
       VALUES ($1, $2, now())
       ON CONFLICT (action_code) DO UPDATE SET required_types = EXCLUDED.required_types, updated_at = now()`,
      [rule.action_code, rule.required_types],
    );
  }
}
