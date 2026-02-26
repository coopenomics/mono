import type { CommitData } from "../entities/commit.entity";

/**
 * Доменный интерфейс для действия создания коммита CAPITAL контракта
 * Пользователь указывает количество часов для коммита
 */
export interface CreateCommitDomainInput {
  /** Имя аккаунта кооператива */
  coopname: string;

  /** Имя пользователя */
  username: string;

  /** Хэш проекта */
  project_hash: string;

  /** Хэш коммита (опционально, генерируется на бэкенде если указан data) */
  commit_hash?: string;

  /** Количество часов для коммита */
  commit_hours: number;

  /** Описание коммита */
  description: string;

  /** Мета-данные коммита */
  meta: string;

  /** Данные коммита (массив структурированных объектов) */
  data: CommitData;
}
