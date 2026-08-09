import type { ISignedDocument } from '@coopenomics/innercoop';
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
  document: ISignedDocument;

  /** Вклад участника (текстовое описание) */
  contribution?: string;
}
