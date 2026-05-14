import { ReportType } from '../enums/report-type.enum';

export const GENERATED_REPORT_REPOSITORY = Symbol('GENERATED_REPORT_REPOSITORY');

export interface GeneratedReportRecord {
  id: string;
  coopname: string;
  report_type: ReportType;
  year: number;
  period?: number | null;
  xml: string;
  file_name: string;
  is_valid: boolean;
  validation_errors?: unknown | null;
  organization_snapshot: unknown;
  corrections_snapshot?: unknown | null;
  generated_by: string;
  created_at: Date;
}

export interface CreateGeneratedReportInput {
  coopname: string;
  report_type: ReportType;
  year: number;
  period?: number | null;
  xml: string;
  file_name: string;
  is_valid: boolean;
  validation_errors?: unknown | null;
  organization_snapshot: unknown;
  corrections_snapshot?: unknown | null;
  generated_by: string;
}

export interface GeneratedReportFilter {
  coopname: string;
  report_type?: ReportType;
  year?: number;
  period?: number | null;
}

export interface GeneratedReportRepository {
  create(input: CreateGeneratedReportInput): Promise<GeneratedReportRecord>;
  findById(id: string): Promise<GeneratedReportRecord | null>;
  findLatest(coopname: string, report_type: ReportType, year: number, period?: number | null): Promise<GeneratedReportRecord | null>;
  list(filter: GeneratedReportFilter, limit: number, offset: number): Promise<{ items: GeneratedReportRecord[]; total: number }>;
}
