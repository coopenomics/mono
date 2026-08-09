import type { ISignedDocument } from '@coopenomics/innercoop';

/**
 * Доменный интерфейс входных данных для завершения регистрации в Capital
 */
export interface CompleteCapitalRegistrationDomainInput {
  coopname: string;
  username: string;
  generation_contract?: ISignedDocument;
  storage_agreement: ISignedDocument;
  blagorost_agreement?: ISignedDocument;
  generator_offer?: ISignedDocument;
  about?: string;
  rate_per_hour?: string;
  hours_per_day?: number;
}
