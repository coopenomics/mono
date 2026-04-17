export const BALANCE_CORRECTION_REPOSITORY = Symbol('BALANCE_CORRECTION_REPOSITORY');

export interface BalanceCorrectionRecord {
  id: string;
  coopname: string;
  year: number;
  account_display_id: string;
  balance_previous: string;
  balance_pre_previous: string;
  updated_by: string;
  updated_at: Date;
}

export interface UpsertBalanceCorrectionInput {
  coopname: string;
  year: number;
  account_display_id: string;
  balance_previous: string | number;
  balance_pre_previous: string | number;
  updated_by: string;
}

export interface BalanceCorrectionRepository {
  upsert(input: UpsertBalanceCorrectionInput): Promise<BalanceCorrectionRecord>;
  upsertMany(inputs: UpsertBalanceCorrectionInput[]): Promise<BalanceCorrectionRecord[]>;
  findForYear(coopname: string, year: number): Promise<BalanceCorrectionRecord[]>;
  findOne(coopname: string, year: number, account_display_id: string): Promise<BalanceCorrectionRecord | null>;
}
