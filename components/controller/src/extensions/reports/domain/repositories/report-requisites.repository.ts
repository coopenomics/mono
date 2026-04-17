export const REPORT_REQUISITES_REPOSITORY = Symbol('REPORT_REQUISITES_REPOSITORY');

export interface ReportRequisitesRecord {
  coopname: string;
  okved: string | null;
  okfs: string | null;
  okopf: string | null;
  oktmo: string | null;
  okpo: string | null;
  sfr_reg_number: string | null;
  chairman_position: string | null;
  signer_snils: string | null;
  signer_rep_doc: string | null;
  phone_override: string | null;
  address_override: string | null;
  updated_by: string;
  updated_at: Date;
}

export interface UpsertReportRequisitesInput {
  coopname: string;
  okved?: string | null;
  okfs?: string | null;
  okopf?: string | null;
  oktmo?: string | null;
  okpo?: string | null;
  sfr_reg_number?: string | null;
  chairman_position?: string | null;
  signer_snils?: string | null;
  signer_rep_doc?: string | null;
  phone_override?: string | null;
  address_override?: string | null;
  updated_by: string;
}

export interface ReportRequisitesRepository {
  getByCoopname(coopname: string): Promise<ReportRequisitesRecord | null>;
  upsert(input: UpsertReportRequisitesInput): Promise<ReportRequisitesRecord>;
}
