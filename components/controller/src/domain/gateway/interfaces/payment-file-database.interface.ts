import { PaymentFileKind } from '../enums/payment-file-kind.enum';

/**
 * Запись о файле, приложенном к платежу (чек об оплате). Сам бинарь лежит в
 * MinIO-бакете `gateway:files`; в блокчейне файла нет — это чистая БД-сущность,
 * для проверки целостности используется `checksum_sha256`.
 *
 * Привязка — по `payment_hash` (единый ключ любого платежа). Ключ MinIO:
 * `{coopname}/gateway/{payment_hash}/{kind}/{checksum}.{ext}`.
 */
export interface IPaymentFileDatabaseData {
  id?: number;
  coopname: string;
  payment_hash: string;
  kind: PaymentFileKind;
  checksum_sha256: string;
  mime_type: string;
  size_bytes: number;
  storage_key: string;
  /** Оригинальное имя загруженного файла — для отображения и поиска */
  original_filename?: string | null;
  uploaded_by_username: string;
  uploaded_at: Date;
}
