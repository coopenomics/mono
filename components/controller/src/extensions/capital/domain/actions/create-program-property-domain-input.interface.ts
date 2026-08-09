import type { ISignedDocument } from '@coopenomics/innercoop';
/**
 * Доменный интерфейс для действия создания программного имущественного взноса CAPITAL контракта
 */
export interface CreateProgramPropertyDomainInput {
  /** Имя аккаунта кооператива */
  coopname: string;

  /** Имя пользователя */
  username: string;

  /** Хэш имущества */
  property_hash: string;

  /** Сумма имущества */
  property_amount: string;

  /** Описание имущества */
  property_description: string;

  /** Заявление */
  statement: ISignedDocument;
}
