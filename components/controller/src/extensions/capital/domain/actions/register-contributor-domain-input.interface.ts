import type { ISignedDocument } from '@coopenomics/innercoop';
/**
 * Доменный интерфейс для действия регистрации участника CAPITAL контракта
 */
export interface RegisterContributorDomainInput {
  /** Имя аккаунта кооператива */
  coopname: string;

  /** Имя пользователя */
  username: string;

  /** Хэш участника для верификации документа */
  contributor_hash: string;

  /** О себе */
  about?: string;

  /** Ставка за час работы */
  rate_per_hour?: string;

  /** Часов в день */
  hours_per_day?: number;

  /** Документ договора УХД */
  contract: ISignedDocument;
}
