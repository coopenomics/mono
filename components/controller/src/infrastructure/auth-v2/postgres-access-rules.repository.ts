import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { DataSource } from 'typeorm';
import config from '~/config/config';
import {
  AccessRuleEffect,
  AccessRulePrincipalKind,
  type AccessRuleRecord,
  type IAccessRulesRepository,
} from '~/domain/auth-v2/ports/access-rules.port';

const VALID_EFFECTS = new Set<string>(Object.values(AccessRuleEffect));

interface AccessRuleRow {
  subject_type: string;
  subject_id: string;
  effect: string;
  action: string;
  resource_type: string;
  conditions: Record<string, unknown> | null;
}

/** Мусорный/неизвестный effect → дефолт allow (как защита от мусора в БД у других repo). */
function toEffect(raw: string): AccessRuleEffect {
  return VALID_EFFECTS.has(raw) ? (raw as AccessRuleEffect) : AccessRuleEffect.Allow;
}

/**
 * Хранилище правил CASL Layer 2 в coop_domain_db (таблица `access_rules`, миграция
 * V2.4.7). Свой DataSource, как `PostgresVerificationRuleRepository`. Истёкшие
 * capabilities (`expires_at <= now`) исключаются на чтении.
 */
@Injectable()
export class PostgresAccessRulesRepository implements IAccessRulesRepository, OnModuleDestroy {
  private ds: DataSource | null = null;
  private initializing: Promise<DataSource> | null = null;

  private getDataSource(): Promise<DataSource> {
    if (this.ds?.isInitialized) {
      return Promise.resolve(this.ds);
    }
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

  async findForPrincipal(roles: string[], username: string): Promise<AccessRuleRecord[]> {
    const ds = await this.getDataSource();
    const rows: AccessRuleRow[] = await ds.query(
      `SELECT subject_type, subject_id, effect, action, resource_type, conditions
         FROM access_rules
        WHERE (
              (subject_type = $1 AND subject_id = ANY($3))
           OR (subject_type = $2 AND subject_id = $4)
        )
          AND (expires_at IS NULL OR expires_at > now())`,
      [AccessRulePrincipalKind.Role, AccessRulePrincipalKind.Participant, roles, username],
    );
    return rows.map((r) => ({
      subjectType: r.subject_type as AccessRulePrincipalKind,
      subjectId: r.subject_id,
      effect: toEffect(r.effect),
      action: r.action,
      resourceType: r.resource_type,
      conditions: r.conditions ?? null,
    }));
  }

  async findForCapabilitySets(setKeys: string[]): Promise<AccessRuleRecord[]> {
    if (!setKeys.length) return [];
    const ds = await this.getDataSource();
    const rows: AccessRuleRow[] = await ds.query(
      `SELECT subject_type, subject_id, effect, action, resource_type, conditions
         FROM access_rules
        WHERE subject_type = $1 AND subject_id = ANY($2)
          AND (expires_at IS NULL OR expires_at > now())`,
      [AccessRulePrincipalKind.CapabilitySet, setKeys],
    );
    return rows.map((r) => ({
      subjectType: r.subject_type as AccessRulePrincipalKind,
      subjectId: r.subject_id,
      effect: toEffect(r.effect),
      action: r.action,
      resourceType: r.resource_type,
      conditions: r.conditions ?? null,
    }));
  }

  async insert(rule: AccessRuleRecord): Promise<void> {
    const ds = await this.getDataSource();
    await ds.query(
      `INSERT INTO access_rules (subject_type, subject_id, effect, action, resource_type, conditions, expires_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now())`,
      [
        rule.subjectType,
        rule.subjectId,
        rule.effect,
        rule.action,
        rule.resourceType,
        rule.conditions ? JSON.stringify(rule.conditions) : null,
        rule.expiresAt ?? null,
      ],
    );
  }

  async onModuleDestroy(): Promise<void> {
    if (this.ds?.isInitialized) {
      await this.ds.destroy();
    }
  }
}
