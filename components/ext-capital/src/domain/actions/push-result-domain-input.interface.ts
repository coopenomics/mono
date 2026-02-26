import type { ResultContributionStatementDocumentDomainInterface } from '~/domain/document/interfaces/result-contribution-statement-document-domain.interface';

/**
 * Доменный интерфейс для действия внесения результата CAPITAL контракта
 */
export interface PushResultDomainInput {
  /** Имя аккаунта кооператива */
  coopname: string;

  /** Имя пользователя */
  username: string;

  /** Хэш проекта */
  project_hash: string;

  /** Хэш результата */
  result_hash: string;

  /** Сумма взноса */
  contribution_amount: string;

  /** Сумма долга к погашению */
  debt_amount: string;

  /** Заявление */
  statement: ResultContributionStatementDocumentDomainInterface;

  /** Хэши долгов для погашения */
  debt_hashes: string[];
}
