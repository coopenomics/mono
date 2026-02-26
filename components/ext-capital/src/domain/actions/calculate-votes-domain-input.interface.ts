/**
 * Доменный интерфейс для действия расчета голосов CAPITAL контракта
 */
export interface CalculateVotesDomainInput {
  /** Имя аккаунта кооператива */
  coopname: string;

  /** Имя пользователя */
  username: string;

  /** Хэш проекта */
  project_hash: string;
}
