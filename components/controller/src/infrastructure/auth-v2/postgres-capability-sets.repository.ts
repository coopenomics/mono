import { affectedRows } from './raw-query-result';
import { Inject, Injectable, OnModuleDestroy, Optional } from '@nestjs/common';
import { ChainChangesService } from '~/infrastructure/blockchain/chain-changes.service';
import { DataSource } from 'typeorm';
import config from '~/config/config';
import {
  type AssignCapabilitySetInput,
  type CapabilitySet,
  type CapabilitySetAssignment,
  type ICapabilitySetsRepository,
} from '~/domain/auth-v2/ports/capability-sets.port';

interface CapabilitySetRow {
  set_key: string;
  title: string;
  description: string;
  builtin: boolean;
  coopname: string | null;
}

interface AssignmentRow {
  username: string;
  set_key: string;
  granted_by: string;
  granted_at: string;
  expires_at: string | null;
}

/**
 * Хранилище назначаемых наборов возможностей в coop_domain_db (таблицы
 * `capability_sets` + `participant_capability_sets`, миграция V2.4.12). Свой
 * DataSource (как `PostgresAccessRulesRepository`). Сами правила наборов лежат в
 * `access_rules` (subject_type='capability_set') — читаются access-rules-репо.
 */
/** Назначения персонала в ленте изменений — объявлены в `chain-changes.service.ts`. */
const PARTICIPANT_CAPABILITY_SETS_TABLE = 'participant_capability_sets';

@Injectable()
export class PostgresCapabilitySetsRepository implements ICapabilitySetsRepository, OnModuleDestroy {
  private ds: DataSource | null = null;
  private initializing: Promise<DataSource> | null = null;

  constructor(
    // Назначения живут в отдельной базе на сыром SQL — подписчик базы узла их
    // не видит, поэтому сигнал ленты изменений публикуется здесь, после записи.
    @Optional() @Inject(ChainChangesService) private readonly feed: ChainChangesService | null = null,
  ) {}

  private signal(username: string, setKey: string): void {
    void this.feed?.publishLocal(PARTICIPANT_CAPABILITY_SETS_TABLE, `${username}:${setKey}`, { username });
  }

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

  async listSets(): Promise<CapabilitySet[]> {
    const ds = await this.getDataSource();
    const rows: CapabilitySetRow[] = await ds.query(
      `SELECT set_key, title, description, builtin, coopname FROM capability_sets ORDER BY set_key`,
    );
    return rows.map(toSet);
  }

  async findSet(setKey: string): Promise<CapabilitySet | null> {
    const ds = await this.getDataSource();
    const rows: CapabilitySetRow[] = await ds.query(
      `SELECT set_key, title, description, builtin, coopname FROM capability_sets WHERE set_key = $1`,
      [setKey],
    );
    return rows[0] ? toSet(rows[0]) : null;
  }

  async listActiveSetKeys(username: string): Promise<string[]> {
    const ds = await this.getDataSource();
    const rows: { set_key: string }[] = await ds.query(
      `SELECT set_key FROM participant_capability_sets
        WHERE username = $1 AND revoked_at IS NULL
          AND (expires_at IS NULL OR expires_at > now())`,
      [username],
    );
    return rows.map((r) => r.set_key);
  }

  async listAssignments(username: string): Promise<CapabilitySetAssignment[]> {
    const ds = await this.getDataSource();
    const rows: AssignmentRow[] = await ds.query(
      `SELECT username, set_key, granted_by, granted_at, expires_at
         FROM participant_capability_sets
        WHERE username = $1 AND revoked_at IS NULL
          AND (expires_at IS NULL OR expires_at > now())
        ORDER BY granted_at DESC`,
      [username],
    );
    return rows.map((r) => ({
      username: r.username,
      setKey: r.set_key,
      grantedBy: r.granted_by,
      grantedAt: r.granted_at,
      expiresAt: r.expires_at,
    }));
  }

  async assign(input: AssignCapabilitySetInput): Promise<void> {
    const ds = await this.getDataSource();
    // Идемпотентно: повторное назначение «оживляет» отозванную/обновляет грант
    // (revoked_at→NULL, новый grantedBy/expires_at). Уникальность — (username, set_key).
    await ds.query(
      `INSERT INTO participant_capability_sets (username, set_key, granted_by, granted_at, expires_at, revoked_at)
       VALUES ($1, $2, $3, now(), $4, NULL)
       ON CONFLICT (username, set_key)
       DO UPDATE SET granted_by = EXCLUDED.granted_by, granted_at = now(),
                     expires_at = EXCLUDED.expires_at, revoked_at = NULL`,
      [input.username, input.setKey, input.grantedBy, input.expiresAt ?? null],
    );
    this.signal(input.username, input.setKey);
  }

  async revoke(username: string, setKey: string): Promise<boolean> {
    const ds = await this.getDataSource();
    // Отозвано ли что-то — по числу затронутых строк (у UPDATE TypeORM отдаёт
    // пару [строки, число]; см. raw-query-result.ts).
    const raw: unknown = await ds.query(
      `UPDATE participant_capability_sets SET revoked_at = now()
        WHERE username = $1 AND set_key = $2 AND revoked_at IS NULL
       RETURNING username`,
      [username, setKey],
    );
    const revoked = affectedRows(raw) > 0;
    if (revoked) this.signal(username, setKey);
    return revoked;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.ds?.isInitialized) {
      await this.ds.destroy();
    }
  }
}

function toSet(r: CapabilitySetRow): CapabilitySet {
  return {
    setKey: r.set_key,
    title: r.title,
    description: r.description,
    builtin: r.builtin,
    coopname: r.coopname,
  };
}
