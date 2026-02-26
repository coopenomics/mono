import type { ISignedDocumentDomainInterface } from '~/domain/document/interfaces/signed-document-domain.interface';

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
  contract: ISignedDocumentDomainInterface;
  storage_agreement: ISignedDocumentDomainInterface;
  blagorost_agreement?: ISignedDocumentDomainInterface;
}
