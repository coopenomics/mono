/**
 * Доменный интерфейс для одобрения коммита
 * Определяет входные данные для операции approve commit
 */
export interface CommitApproveDomainInput {
  /** Имя аккаунта кооператива */
  coopname: string;

  /** Имя мастера (пользователя, выполняющего approve) */
  master: string;

  /** Хэш коммита для одобрения */
  commit_hash: string;
}
