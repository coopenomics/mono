import type { ISignedDocumentDomainInterface } from '~/domain/document/interfaces/signed-document-domain.interface';
/**
 * Доменный интерфейс для действия создания долга CAPITAL контракта
 */
export interface CreateDebtDomainInput {
  /** Имя аккаунта кооператива */
  coopname: string;

  /** Имя пользователя */
  username: string;

  /** Хэш долга */
  debt_hash: string;

  /** Хэш проекта */
  project_hash: string;

  /** Сумма долга */
  amount: string;

  /** Дата возврата */
  repaid_at: string;

  /** Заявление */
  statement: ISignedDocumentDomainInterface;
}
