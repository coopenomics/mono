import type { ISignedDocumentDomainInterface } from '~/domain/document/interfaces/signed-document-domain.interface';

/**
 * Доменный интерфейс для действия подписания акта председателем CAPITAL контракта
 */
export interface SignActAsChairmanDomainInput {
  /** Имя аккаунта кооператива */
  coopname: string;

  /** Имя председателя */
  chairman: string;

  /** Хэш результата */
  result_hash: string;

  /** Акт о вкладе результатов */
  act: ISignedDocumentDomainInterface;
}
