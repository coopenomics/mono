import type { ISignedDocumentDomainInterface } from '~/domain/document/interfaces/signed-document-domain.interface';
/**
 * Доменный интерфейс для действия создания расхода CAPITAL контракта
 */
export interface CreateExpenseDomainInput {
  /** Имя аккаунта кооператива */
  coopname: string;

  /** Хэш расхода */
  expense_hash: string;

  /** Хэш проекта */
  project_hash: string;

  /** Сумма расхода */
  amount: string;

  /** Описание расхода */
  description: string;

  /** Исполнитель расхода */
  creator: string;

  /** Служебная записка о расходе */
  statement: ISignedDocumentDomainInterface;
}
