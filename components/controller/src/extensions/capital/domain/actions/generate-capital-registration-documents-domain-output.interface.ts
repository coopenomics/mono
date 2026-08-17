import type { GeneratedDocumentDTO } from '@coopenomics/extension-kit';

/**
 * Доменный интерфейс выходных данных для генерации документов регистрации в Capital
 */
export interface GenerateCapitalRegistrationDocumentsDomainOutput {
  generation_contract?: GeneratedDocumentDTO;
  storage_agreement?: GeneratedDocumentDTO;
  blagorost_agreement?: GeneratedDocumentDTO;
  generator_offer?: GeneratedDocumentDTO;
}
