import { ReportType } from '../enums/report-type.enum';

export const REPORT_DRAFT_REPOSITORY = Symbol('REPORT_DRAFT_REPOSITORY');

export interface ReportDraftRecord {
  id: string;
  coopname: string;
  owner_username: string;
  report_type: ReportType;
  year: number;
  period?: number | null;
  edits_json: unknown;
  edited_fields: string[];
  created_at: Date;
  updated_at: Date;
}

export interface SaveReportDraftInput {
  coopname: string;
  owner_username: string;
  report_type: ReportType;
  year: number;
  period?: number | null;
  edits_json: unknown;
  edited_fields: string[];
}

export interface ReportDraftFilter {
  coopname: string;
  owner_username: string;
  report_type?: ReportType;
  year?: number;
  period?: number | null;
}

export interface ReportDraftRepository {
  /** Upsert по (coopname, owner_username, report_type, year, period). */
  save(input: SaveReportDraftInput): Promise<ReportDraftRecord>;
  findById(id: string): Promise<ReportDraftRecord | null>;
  findOne(
    coopname: string,
    owner_username: string,
    report_type: ReportType,
    year: number,
    period?: number | null,
  ): Promise<ReportDraftRecord | null>;
  list(filter: ReportDraftFilter): Promise<ReportDraftRecord[]>;
  /** Удаление по id, возвращает true если удалено. */
  delete(id: string, coopname: string, owner_username: string): Promise<boolean>;
}
