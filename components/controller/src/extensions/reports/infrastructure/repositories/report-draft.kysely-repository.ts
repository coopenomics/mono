import { Inject, Injectable } from '@nestjs/common';
import { sql, type Kysely, type Selectable } from 'kysely';
import { KYSELY, affectedCount } from '@coopenomics/extension-kit';
import type {
  ReportDraftFilter,
  ReportDraftRecord,
  ReportDraftRepository,
  SaveReportDraftInput,
} from '../../domain/repositories/report-draft.repository';
import { ReportType } from '../../domain/enums/report-type.enum';
import type { DB, ReportDrafts } from '../database/reports.database.types';

function toRecord(row: Selectable<ReportDrafts>): ReportDraftRecord {
  return {
    ...row,
    report_type: row.report_type as ReportType,
    edits_json: row.edits_json as ReportDraftRecord['edits_json'],
    edited_fields: (row.edited_fields as unknown as ReportDraftRecord['edited_fields']) ?? [],
  };
}

/** Черновики правок отчёта у пользователя (таблица `report_drafts`). */
@Injectable()
export class ReportDraftKyselyRepository implements ReportDraftRepository {
  constructor(@Inject(KYSELY) private readonly db: Kysely<DB>) {}

  /**
   * Черновик на отчёт у пользователя один. Период может быть пустым (годовой
   * отчёт), а пустое значение уникальным индексом не сравнивается — поэтому
   * запись ищется явно и затем правится либо создаётся.
   */
  async save(input: SaveReportDraftInput): Promise<ReportDraftRecord> {
    const existing = await this.findOne(input.coopname, input.owner_username, input.report_type, input.year, input.period);
    const content = { edits_json: JSON.stringify(input.edits_json), edited_fields: JSON.stringify(input.edited_fields) };
    if (existing) {
      const row = await this.db
        .updateTable('report_drafts')
        .set({ ...content, updated_at: sql`now()` })
        .where('id', '=', existing.id)
        .returningAll()
        .executeTakeFirstOrThrow();
      return toRecord(row);
    }
    const row = await this.db
      .insertInto('report_drafts')
      .values({
        coopname: input.coopname,
        owner_username: input.owner_username,
        report_type: input.report_type,
        year: input.year,
        period: input.period ?? null,
        ...content,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return toRecord(row);
  }

  async findById(id: string): Promise<ReportDraftRecord | null> {
    const row = await this.db.selectFrom('report_drafts').selectAll().where('id', '=', id).executeTakeFirst();
    return row ? toRecord(row) : null;
  }

  async findOne(
    coopname: string,
    owner_username: string,
    report_type: ReportType,
    year: number,
    period?: number | null
  ): Promise<ReportDraftRecord | null> {
    let query = this.db
      .selectFrom('report_drafts')
      .selectAll()
      .where('coopname', '=', coopname)
      .where('owner_username', '=', owner_username)
      .where('report_type', '=', report_type)
      .where('year', '=', year);
    query = period == null ? query.where('period', 'is', null) : query.where('period', '=', period);
    const row = await query.executeTakeFirst();
    return row ? toRecord(row) : null;
  }

  /** Черновики пользователя, последние правки сверху. */
  async list(filter: ReportDraftFilter): Promise<ReportDraftRecord[]> {
    let query = this.db
      .selectFrom('report_drafts')
      .selectAll()
      .where('coopname', '=', filter.coopname)
      .where('owner_username', '=', filter.owner_username);
    if (filter.report_type) query = query.where('report_type', '=', filter.report_type);
    if (filter.year !== undefined) query = query.where('year', '=', filter.year);
    if (filter.period === null) query = query.where('period', 'is', null);
    else if (typeof filter.period === 'number') query = query.where('period', '=', filter.period);
    const rows = await query.orderBy('updated_at', 'desc').execute();
    return rows.map(toRecord);
  }

  /** Кооператив и владелец в условии — чужой черновик не удалить, даже угадав его ключ. */
  async delete(id: string, coopname: string, owner_username: string): Promise<boolean> {
    const result = await this.db
      .deleteFrom('report_drafts')
      .where('id', '=', id)
      .where('coopname', '=', coopname)
      .where('owner_username', '=', owner_username)
      .execute();
    return affectedCount(result) > 0;
  }
}
