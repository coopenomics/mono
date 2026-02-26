/**
 * Доменный интерфейс для действия редактирования участника CAPITAL контракта
 */
export interface EditContributorDomainInput {
  /** Имя аккаунта кооператива */
  coopname: string;

  /** Имя пользователя */
  username: string;

  /** О себе */
  about?: string;

  /** Ставка за час работы */
  rate_per_hour?: string;

  /** Часов в день */
  hours_per_day?: number;
}
