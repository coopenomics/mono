import { ExpenseFileKind } from '../enums/expense-file-kind.enum';

/**
 * Запись о первичном файле расхода — платёжке, чеке, доказательстве возврата.
 * Сам бинарь лежит в MinIO-бакете `expenses:files`. В блокчейне файла нет —
 * это чистая БД-сущность; для on-chain валидации используется `checksum_sha256`.
 *
 * Ключ MinIO: `{coopname}/expenses/{proposal_hash}/{item_hash|_proposal}/{kind}/{checksum}.{ext}`.
 */
export interface IExpenseFileDatabaseData {
  id?: number;
  coopname: string;
  proposal_hash: string;
  item_hash?: string | null;
  kind: ExpenseFileKind;
  checksum_sha256: string;
  mime_type: string;
  size_bytes: number;
  storage_key: string;
  /** Оригинальное имя загруженного файла — для отображения и поиска */
  original_filename?: string | null;
  uploaded_by_username: string;
  uploaded_at: Date;
}
