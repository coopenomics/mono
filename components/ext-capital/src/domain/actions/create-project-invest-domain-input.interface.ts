import type { ISignedDocumentDomainInterface } from '~/domain/document/interfaces/signed-document-domain.interface';
/**
 * Доменный интерфейс для действия инвестирования в проект CAPITAL контракта
 */
export interface CreateProjectInvestDomainInput {
  /** Имя аккаунта кооператива */
  coopname: string;

  /** Хэш проекта */
  project_hash: string;

  /** Имя инвестора */
  username: string;

  /** Хэш инвестиции */
  invest_hash: string;

  /** Сумма инвестиции */
  amount: string;

  /** Заявление на инвестирование */
  statement: ISignedDocumentDomainInterface;
}
