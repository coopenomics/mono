import { Inject, Injectable } from '@nestjs/common';
import type { Selectable } from 'kysely';
import type { TrackingRule, DecisionEventType } from '@coopenomics/innercoop';
import { KYSELY, type Database } from '~/infrastructure/database/kysely/kysely.tokens';
import type { TrackingRules } from '~/infrastructure/database/kysely/database.types';

/**
 * Хранилище правил отслеживания решений (таблица `tracking_rules`).
 */
@Injectable()
export class TrackingRuleKyselyRepository {
  constructor(@Inject(KYSELY) private readonly db: Database) {}

  async save(rule: TrackingRule): Promise<TrackingRule> {
    const values = this.toRow(rule);
    const row = await this.db
      .insertInto('tracking_rules')
      .values(values)
      .onConflict((conflict) => conflict.column('id').doUpdateSet(values))
      .returningAll()
      .executeTakeFirstOrThrow();
    return this.toDomain(row);
  }

  async findById(id: string): Promise<TrackingRule | null> {
    const row = await this.db.selectFrom('tracking_rules').selectAll().where('id', '=', id).executeTakeFirst();
    return row ? this.toDomain(row) : null;
  }

  async findByHash(hash: string): Promise<TrackingRule | null> {
    const row = await this.db
      .selectFrom('tracking_rules')
      .selectAll()
      .where('hash', '=', hash)
      .where('active', '=', true)
      .executeTakeFirst();
    return row ? this.toDomain(row) : null;
  }

  async findAllActive(): Promise<TrackingRule[]> {
    const rows = await this.db
      .selectFrom('tracking_rules')
      .selectAll()
      .where('active', '=', true)
      .orderBy('created_at', 'asc')
      .execute();
    return rows.map((row) => this.toDomain(row));
  }

  async update(rule: TrackingRule): Promise<TrackingRule> {
    const row = await this.db
      .updateTable('tracking_rules')
      .set(this.toRow(rule))
      .where('id', '=', rule.id)
      .returningAll()
      .executeTakeFirst();
    if (!row) {
      throw new Error(`Tracking rule with id ${rule.id} not found after update`);
    }
    return this.toDomain(row);
  }

  async delete(id: string): Promise<void> {
    await this.db.deleteFrom('tracking_rules').where('id', '=', id).execute();
  }

  private toRow(domain: TrackingRule) {
    return {
      id: domain.id,
      hash: domain.hash,
      event_type: domain.event_type,
      vars_field: domain.vars_field,
      // Колонка jsonb: объект передаётся текстом, иначе драйвер разложил бы массив в массив Postgres.
      metadata: domain.metadata == null ? null : JSON.stringify(domain.metadata),
      active: domain.active,
      created_at: domain.created_at,
    };
  }

  private toDomain(row: Selectable<TrackingRules>): TrackingRule {
    return {
      id: row.id,
      hash: row.hash,
      event_type: row.event_type as DecisionEventType,
      vars_field: row.vars_field,
      metadata: (row.metadata as Record<string, unknown> | null) ?? {},
      active: row.active,
      created_at: row.created_at,
    };
  }
}
