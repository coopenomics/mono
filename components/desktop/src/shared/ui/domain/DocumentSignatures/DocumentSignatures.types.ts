export interface DocumentSignatureEntry {
  /** ФИО подписанта (резолвится caller'ом из сертификата) */
  signerName: string;
  /** Публичный ключ подписанта (EOS_K1...) */
  publicKey?: string;
  /** Цифровая подпись (SIG_K1_...) */
  signature?: string;
  /** Прошла ли подпись верификацию */
  isValid?: boolean;
}

export interface DocumentSignaturesProps {
  /** Контрольная сумма документа из бэкенда */
  docHash: string;
  /** Контрольная сумма, пересчитанная на клиенте. Если задана и == docHash — отметка «верно». */
  regeneratedHash?: string;
  /** Список приложенных подписей */
  signatures?: DocumentSignatureEntry[];
  /** Идёт ли сейчас «сверка» — для loading-состояния кнопки */
  verifying?: boolean;
  /** Скрыть кнопку «скачать» */
  hideDownload?: boolean;
  /** Скрыть кнопку «сверить» */
  hideVerify?: boolean;
}
