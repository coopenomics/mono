/**
 * Доменный интерфейс входных данных для генерации документов регистрации в Capital
 */
export interface GenerateCapitalRegistrationDocumentsDomainInput {
  coopname: string;
  username: string;
  lang?: string;
}
