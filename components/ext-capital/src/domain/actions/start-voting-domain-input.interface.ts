/**
 * Доменный интерфейс для действия запуска голосования CAPITAL контракта
 */
export interface StartVotingDomainInput {
  /** Имя аккаунта кооператива */
  coopname: string;

  /** Хэш проекта */
  project_hash: string;
}
