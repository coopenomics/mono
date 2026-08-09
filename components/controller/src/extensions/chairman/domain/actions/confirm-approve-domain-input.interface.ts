import type { ISignedDocument } from '@coopenomics/innercoop';

/**
 * Доменный интерфейс для действия подтверждения одобрения документа CHAIRMAN контракта
 */
export interface ConfirmApproveDomainInput {
  /** Имя аккаунта кооператива */
  coopname: string;

  /** Имя пользователя */
  username: string;

  /** Хеш одобрения для идентификации */
  approval_hash: string;

  /** Одобренный документ */
  approved_document?: ISignedDocument;
}
