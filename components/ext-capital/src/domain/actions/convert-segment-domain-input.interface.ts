import type { ISignedDocumentDomainInterface } from '~/domain/document/interfaces/signed-document-domain.interface';

/**
 * Доменный интерфейс для действия конвертации сегмента CAPITAL контракта
 */
export interface ConvertSegmentDomainInput {
  /** Имя аккаунта кооператива */
  coopname: string;

  /** Имя пользователя */
  username: string;

  /** Хэш проекта */
  project_hash: string;

  /** Хэш конвертации */
  convert_hash: string;

  /** Сумма для конвертации в главный кошелек */
  wallet_amount: string;

  /** Сумма для конвертации в капитализацию */
  capital_amount: string;

  /** Заявление */
  convert_statement: ISignedDocumentDomainInterface;
}
