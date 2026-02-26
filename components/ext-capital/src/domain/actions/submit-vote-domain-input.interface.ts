/**
 * Доменный интерфейс для действия голосования CAPITAL контракта
 */
export interface SubmitVoteDomainInput {
  /** Имя аккаунта кооператива */
  coopname: string;

  /** Имя голосующего */
  voter: string;

  /** Хэш проекта */
  project_hash: string;

  /** Распределение голосов */
  votes: Array<{
    recipient: string;
    amount: string;
  }>;
}
