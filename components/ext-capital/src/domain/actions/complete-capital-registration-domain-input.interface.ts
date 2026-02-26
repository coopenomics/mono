import type { ISignedDocumentDomainInterface } from '~/domain/document/interfaces/signed-document-domain.interface';

/**
 * Доменный интерфейс входных данных для завершения регистрации в Capital
 */
export interface CompleteCapitalRegistrationDomainInput {
  coopname: string;
  username: string;
  generation_contract?: ISignedDocumentDomainInterface;
  storage_agreement: ISignedDocumentDomainInterface;
  blagorost_agreement?: ISignedDocumentDomainInterface;
  generator_offer?: ISignedDocumentDomainInterface;
  about?: string;
  rate_per_hour?: string;
  hours_per_day?: number;
}
