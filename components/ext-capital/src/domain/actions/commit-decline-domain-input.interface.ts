/**
 * Доменный интерфейс для отклонения коммита
 * Определяет входные данные для операции decline commit
 */
export interface CommitDeclineDomainInput {
  /** Имя аккаунта кооператива */
  coopname: string;

  /** Имя мастера (пользователя, выполняющего decline) */
  master: string;

  /** Хэш коммита для отклонения */
  commit_hash: string;

  /** Причина отклонения */
  reason: string;
}
