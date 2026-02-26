/**
 * Доменный интерфейс для действия завершения голосования CAPITAL контракта
 */
export interface CompleteVotingDomainInput {
  /** Имя аккаунта кооператива */
  coopname: string;

  /** Хэш проекта */
  project_hash: string;
}
