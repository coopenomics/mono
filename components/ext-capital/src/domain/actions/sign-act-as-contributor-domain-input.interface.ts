import type { ISignedDocumentDomainInterface } from '~/domain/document/interfaces/signed-document-domain.interface';

/**
 * Доменный интерфейс для действия подписания акта участником CAPITAL контракта
 */
export interface SignActAsContributorDomainInput {
  /** Имя аккаунта кооператива */
  coopname: string;

  /** Имя пользователя */
  username: string;

  /** Хэш результата */
  result_hash: string;

  /** Акт о вкладе результатов */
  act: ISignedDocumentDomainInterface;
}
