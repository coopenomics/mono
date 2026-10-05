import { Inject, Injectable } from '@nestjs/common';
import { sql, type Kysely } from 'kysely';
import { KYSELY } from '@coopenomics/extension-kit';
import type {
  BalanceCorrectionRecord,
  BalanceCorrectionRepository,
  UpsertBalanceCorrectionInput,
} from '../../domain/repositories/balance-correction.repository';
import type { DB } from '../database/reports.database.types';

/** Ручные корректировки балансов прошлых периодов (таблица `balance_corrections`). */
@Injectable()
export class BalanceCorrectionKyselyRepository implements BalanceCorrectionRepository {
  constructor(@Inject(KYSELY) private readonly db: Kysely<DB>) {}

  async upsert(input: UpsertBalanceCorrectionInput): Promise<BalanceCorrectionRecord> {
    const [saved] = await this.upsertMany([input]);
    return saved;
  }

  /** Одним запросом: сохранены либо все строки, либо ни одной. */
  async upsertMany(inputs: UpsertBalanceCorrectionInput[]): Promise<BalanceCorrectionRecord[]> {
    if (inputs.length === 0) return [];
    return this.db
      .insertInto('balance_corrections')
      .values(
        inputs.map((input) => ({
          coopname: input.coopname,
          year: input.year,
          account_display_id: input.account_display_id,
          balance_previous: String(input.balance_previous),
          balance_pre_previous: String(input.balance_pre_previous),
          updated_by: input.updated_by,
        }))
      )
      .onConflict((conflict) =>
        conflict.columns(['coopname', 'year', 'account_display_id']).doUpdateSet({
          balance_previous: sql`excluded.balance_previous`,
          balance_pre_previous: sql`excluded.balance_pre_previous`,
          updated_by: sql`excluded.updated_by`,
          updated_at: sql`now()`,
        })
      )
      .returningAll()
      .execute();
  }

  async findForYear(coopname: string, year: number): Promise<BalanceCorrectionRecord[]> {
    return this.db
      .selectFrom('balance_corrections')
      .selectAll()
      .where('coopname', '=', coopname)
      .where('year', '=', year)
      .orderBy('account_display_id', 'asc')
      .execute();
  }

  async findOne(coopname: string, year: number, account_display_id: string): Promise<BalanceCorrectionRecord | null> {
    const row = await this.db
      .selectFrom('balance_corrections')
      .selectAll()
      .where('coopname', '=', coopname)
      .where('year', '=', year)
      .where('account_display_id', '=', account_display_id)
      .executeTakeFirst();
    return row ?? null;
  }
}
