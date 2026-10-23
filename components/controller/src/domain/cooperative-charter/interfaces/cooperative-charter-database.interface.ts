/**
 * Запись об уставе кооператива: бинарь лежит в бакете `registrator:charters`,
 * здесь — метаданные и привязка к аккаунту кооператива.
 */
export interface ICooperativeCharterDatabaseData {
  id?: number;
  /** Контур, в котором хранится файл (союз-оператор, например voskhod). */
  coopname: string;
  /** Аккаунт кооператива, чей это устав. */
  username: string;
  checksum_sha256: string;
  mime_type: string;
  size_bytes: number;
  storage_key: string;
  original_filename: string | null;
  uploaded_by_username: string;
  uploaded_at: Date;
}
