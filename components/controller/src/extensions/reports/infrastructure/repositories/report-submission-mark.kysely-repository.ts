import { Inject, Injectable } from '@nestjs/common';
import { sql, type Kysely, type Selectable } from 'kysely';
import { KYSELY } from '@coopenomics/extension-kit';
import type {
  ReportSubmissionMarkFilter,
  ReportSubmissionMarkRecord,
  ReportSubmissionMarkRepository,
} from '../../domain/repositories/report-submission-mark.repository';
import { ReportType } from '../../domain/enums/report-type.enum';
import { ReportSubmissionMark } from '../../domain/enums/report-submission-mark.enum';
import type { DB, ReportSubmissionMarks } from '../database/reports.database.types';

function toRecord(row: Selectable<ReportSubmissionMarks>): ReportSubmissionMarkRecord {
  return { ...row, report_type: row.report_type as ReportType, mark: row.mark as ReportSubmissionMark };
}

/** Отметки о сдаче отчётов (таблица `report_submission_marks`). */
@Injectable()
export class ReportSubmissionMarkKyselyRepository implements ReportSubmissionMarkRepository {
  constructor(@Inject(KYSELY) private readonly db: Kysely<DB>) {}

  /**
   * Отметка на отчёт одна. Период может быть пустым (годовой отчёт), а пустое
   * значение уникальным индексом не сравнивается — поэтому запись ищется явно
   * и затем правится либо создаётся.
   */
  async set(input: {
    coopname: string;
    report_type: ReportType;
    year: number;
    period?: number | null;
    mark: ReportSubmissionMark;
    created_by: string;
  }): Promise<ReportSubmissionMarkRecord> {
    const existing = await this.findOne(input.coopname, input.report_type, input.year, input.period);
    if (existing) {
      const row = await this.db
        .updateTable('report_submission_marks')
        .set({ mark: input.mark, created_by: input.created_by, updated_at: sql`now()` })
        .where('id', '=', existing.id)
        .returningAll()
        .executeTakeFirstOrThrow();
      return toRecord(row);
    }
    const row = await this.db
      .insertInto('report_submission_marks')
      .values({
        coopname: input.coopname,
        report_type: input.report_type,
        year: input.year,
        period: input.period ?? null,
        mark: input.mark,
        created_by: input.created_by,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return toRecord(row);
  }

  async findOne(
    coopname: string,
    report_type: ReportType,
    year: number,
    period?: number | null
  ): Promise<ReportSubmissionMarkRecord | null> {
    const row = await this.scoped(coopname, report_type, year, period).selectAll().executeTakeFirst();
    return row ? toRecord(row) : null;
  }

  async list(filter: ReportSubmissionMarkFilter): Promise<ReportSubmissionMarkRecord[]> {
    let query = this.db.selectFrom('report_submission_marks').selectAll().where('coopname', '=', filter.coopname);
    if (filter.report_type) query = query.where('report_type', '=', filter.report_type);
    if (filter.year !== undefined) query = query.where('year', '=', filter.year);
    if (filter.period === null) query = query.where('period', 'is', null);
    else if (typeof filter.period === 'number') query = query.where('period', '=', filter.period);
    const rows = await query.execute();
    return rows.map(toRecord);
  }

  async remove(coopname: string, report_type: ReportType, year: number, period?: number | null): Promise<boolean> {
    let query = this.db
      .deleteFrom('report_submission_marks')
      .where('coopname', '=', coopname)
      .where('report_type', '=', report_type)
      .where('year', '=', year);
    query = period == null ? query.where('period', 'is', null) : query.where('period', '=', period);
    const result = await query.executeTakeFirst();
    return Number(result.numDeletedRows ?? 0) > 0;
  }

  /** Отметка одного отчёта: пустой период — годовой отчёт. */
  private scoped(coopname: string, report_type: ReportType, year: number, period?: number | null) {
    const query = this.db
      .selectFrom('report_submission_marks')
      .where('coopname', '=', coopname)
      .where('report_type', '=', report_type)
      .where('year', '=', year);
    return period == null ? query.where('period', 'is', null) : query.where('period', '=', period);
  }
}
