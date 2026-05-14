import { ReportType } from '../enums/report-type.enum';
import { ReportSubmissionMark } from '../enums/report-submission-mark.enum';

export const REPORT_SUBMISSION_MARK_REPOSITORY = Symbol('REPORT_SUBMISSION_MARK_REPOSITORY');

export interface ReportSubmissionMarkRecord {
  id: string;
  coopname: string;
  report_type: ReportType;
  year: number;
  period?: number | null;
  mark: ReportSubmissionMark;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface ReportSubmissionMarkFilter {
  coopname: string;
  report_type?: ReportType;
  year?: number;
  period?: number | null;
}

export interface ReportSubmissionMarkRepository {
  /** Upsert по (coopname, report_type, year, period). */
  set(input: {
    coopname: string;
    report_type: ReportType;
    year: number;
    period?: number | null;
    mark: ReportSubmissionMark;
    created_by: string;
  }): Promise<ReportSubmissionMarkRecord>;

  findOne(
    coopname: string,
    report_type: ReportType,
    year: number,
    period?: number | null,
  ): Promise<ReportSubmissionMarkRecord | null>;

  list(filter: ReportSubmissionMarkFilter): Promise<ReportSubmissionMarkRecord[]>;

  /** true если удалено. */
  remove(
    coopname: string,
    report_type: ReportType,
    year: number,
    period?: number | null,
  ): Promise<boolean>;
}
