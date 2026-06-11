import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { DataSource } from 'typeorm';
import config from '~/config/config';
import type { IVerificationRuleRepository } from '~/domain/auth-v2/ports/verification-rule.port';
import { VerificationType, type VerificationRule } from '~/domain/auth-v2/verification/verification.types';

const VALID_TYPES = new Set<string>(Object.values(VerificationType));

/** Оставляем только валидные типы верификации — защита от мусора в БД (как recovery_strategy). */
function sanitizeTypes(raw: string[]): VerificationType[] {
  return raw.filter((t): t is VerificationType => VALID_TYPES.has(t));
}

/**
 * Хранилище правил верификации в coop_domain_db (таблица `verification_rules`,
 * миграция V2.4.5). Свой DataSource, как `PostgresRecoveryStrategyRepository`.
 * `required_types` — postgres `text[]`; невалидные значения отбрасываются на чтении.
 */
@Injectable()
export class PostgresVerificationRuleRepository implements IVerificationRuleRepository, OnModuleDestroy {
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

  async findByActionCode(actionCode: string): Promise<VerificationRule | null> {
    const ds = await this.getDataSource();
    const rows: Array<{ required_types: string[] }> = await ds.query(
      `SELECT required_types FROM verification_rules WHERE action_code=$1`,
      [actionCode],
    );
    if (!rows.length) return null;
    return { action_code: actionCode, required_types: sanitizeTypes(rows[0].required_types ?? []) };
  }

  async list(): Promise<VerificationRule[]> {
    const ds = await this.getDataSource();
    const rows: Array<{ action_code: string; required_types: string[] }> = await ds.query(
      `SELECT action_code, required_types FROM verification_rules ORDER BY action_code`,
    );
    return rows.map((r) => ({ action_code: r.action_code, required_types: sanitizeTypes(r.required_types ?? []) }));
  }

  async upsert(rule: VerificationRule): Promise<void> {
    const ds = await this.getDataSource();
    await ds.query(
      `INSERT INTO verification_rules (action_code, required_types, updated_at)
       VALUES ($1, $2, now())
       ON CONFLICT (action_code) DO UPDATE SET required_types = EXCLUDED.required_types, updated_at = now()`,
      [rule.action_code, rule.required_types],
    );
  }

  async onModuleDestroy(): Promise<void> {
    if (this.ds?.isInitialized) await this.ds.destroy();
  }
}
