import type { ISignedDocumentDomainInterface } from '@coopenomics/innercoop';
/**
 * Доменный интерфейс для действия подписания приложения CAPITAL контракта
 */
export interface MakeClearanceDomainInput {
  /** Имя аккаунта кооператива */
  coopname: string;

  /** Имя пользователя */
  username: string;

  /** Хэш проекта */
  project_hash: string;

  /** Хэш приложения */
  appendix_hash: string;

  /** Документ */
  document: ISignedDocumentDomainInterface;

  /** Вклад участника (текстовое описание) */
  contribution?: string;
}
