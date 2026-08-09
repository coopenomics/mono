import type { ISignedDocument } from '@coopenomics/innercoop';

/**
 * Доменный интерфейс входных данных для регистрации участника с соглашениями
 */
export interface RegisterContributorWithAgreementsDomainInput {
  coopname: string;
  username: string;
  contributor_hash: string;
  rate_per_hour?: string;
  hours_per_day?: number;
  is_external_contract?: boolean;
  contract: ISignedDocument;
  storage_agreement: ISignedDocument;
  blagorost_agreement?: ISignedDocument;
}
