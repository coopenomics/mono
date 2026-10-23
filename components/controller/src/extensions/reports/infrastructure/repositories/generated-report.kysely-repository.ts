import { Inject, Injectable } from '@nestjs/common';
import type { Kysely, Selectable } from 'kysely';
import { KYSELY } from '@coopenomics/extension-kit';
import type {
  CreateGeneratedReportInput,
  GeneratedReportFilter,
  GeneratedReportRecord,
  GeneratedReportRepository,
} from '../../domain/repositories/generated-report.repository';
import { ReportType } from '../../domain/enums/report-type.enum';
import type { DB, GeneratedReports } from '../database/reports.database.types';

const json = (value: unknown): string | null => (value == null ? null : JSON.stringify(value));

function toRecord(row: Selectable<GeneratedReports>): GeneratedReportRecord {
  return {
    ...row,
    report_type: row.report_type as ReportType,
    validation_errors: row.validation_errors as GeneratedReportRecord['validation_errors'],
    organization_snapshot: row.organization_snapshot as GeneratedReportRecord['organization_snapshot'],
    corrections_snapshot: row.corrections_snapshot as GeneratedReportRecord['corrections_snapshot'],
  };
}

/** Сформированные отчёты кооператива (таблица `generated_reports`). */
@Injectable()
export class GeneratedReportKyselyRepository implements GeneratedReportRepository {
  constructor(@Inject(KYSELY) private readonly db: Kysely<DB>) {}

  async create(input: CreateGeneratedReportInput): Promise<GeneratedReportRecord> {
    const row = await this.db
      .insertInto('generated_reports')
      .values({
        coopname: input.coopname,
        report_type: input.report_type,
        year: input.year,
        period: input.period ?? null,
        xml: input.xml,
        file_name: input.file_name,
        is_valid: input.is_valid,
        validation_errors: json(input.validation_errors),
        organization_snapshot: JSON.stringify(input.organization_snapshot),
        corrections_snapshot: json(input.corrections_snapshot),
        generated_by: input.generated_by,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return toRecord(row);
  }

  async findById(id: string): Promise<GeneratedReportRecord | null> {
    const row = await this.db.selectFrom('generated_reports').selectAll().where('id', '=', id).executeTakeFirst();
    return row ? toRecord(row) : null;
  }

  /**
   * Самый свежий отчёт за год. Период не задан — любой (квартал, полугодие,
   * год); `null` — только годовые; число — точное совпадение.
   */
  async findLatest(
    coopname: string,
    report_type: ReportType,
    year: number,
    period?: number | null
  ): Promise<GeneratedReportRecord | null> {
    let query = this.db
      .selectFrom('generated_reports')
      .selectAll()
      .where('coopname', '=', coopname)
      .where('report_type', '=', report_type)
      .where('year', '=', year);
    if (period === null) query = query.where('period', 'is', null);
    else if (typeof period === 'number') query = query.where('period', '=', period);
    const row = await query.orderBy('created_at', 'desc').limit(1).executeTakeFirst();
    return row ? toRecord(row) : null;
  }

  /** Реестр отчётов с отбором, новые сверху; период отбирается так же, как в `findLatest`. */
  async list(
    filter: GeneratedReportFilter,
    limit: number,
    offset: number
  ): Promise<{ items: GeneratedReportRecord[]; total: number }> {
    let query = this.db.selectFrom('generated_reports').where('coopname', '=', filter.coopname);
    if (filter.report_type) query = query.where('report_type', '=', filter.report_type);
    if (filter.year !== undefined) query = query.where('year', '=', filter.year);
    if (filter.period === null) query = query.where('period', 'is', null);
    else if (typeof filter.period === 'number') query = query.where('period', '=', filter.period);

    const rows = await query.selectAll().orderBy('created_at', 'desc').offset(offset).limit(limit).execute();
    const total = await query.select((eb) => eb.fn.countAll<string>().as('count')).executeTakeFirstOrThrow();
    return { items: rows.map(toRecord), total: Number(total.count) };
  }
}
