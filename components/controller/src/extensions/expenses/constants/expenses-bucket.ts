/**
 * Spec MinIO-бакета `expenses:files` — хранилище первичных файлов СЗ-расхода.
 *
 * Содержимое:
 *  - платёжки (PAYMENT_PROOF)  — подтверждение оплаты item-а;
 *  - чеки / акты   (REPORT_FILE)   — подтверждение фактического расхода (ADVANCE);
 *  - возвраты      (RETURN_PROOF)  — подтверждение возврата неиспользованного аванса.
 *
 * Ключ объекта:
 *   `{coopname}/expenses/{proposal_hash}/{item_hash|_proposal}/{kind}/{checksum}.{ext}`
 */
export const EXPENSES_BUCKET = {
  name: 'expenses:files',
  maxBytes: 20 * 1024 * 1024,
  allowedMime: [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'application/pdf',
  ] as const,
  defaultUrlTtlSeconds: 600,
} as const;

export type ExpensesBucketAllowedMime = (typeof EXPENSES_BUCKET.allowedMime)[number];
