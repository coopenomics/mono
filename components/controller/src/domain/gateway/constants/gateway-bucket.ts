/**
 * Spec MinIO-бакета `gateway:files` — ядровое хранилище файлов платежей.
 *
 * Содержимое: чеки об оплате (PAYMENT_PROOF) по исходящим платежам — единая
 * «культура денег» (входящие подтверждаем, исходящие сопровождаем чеком).
 * Привязка по `payment_hash`; переиспользуется всеми расширениями.
 *
 * Ключ объекта: `{coopname}/gateway/{payment_hash}/{kind}/{checksum}.{ext}`.
 */
export const GATEWAY_BUCKET = {
  name: 'gateway:files',
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

export type GatewayBucketAllowedMime = (typeof GATEWAY_BUCKET.allowedMime)[number];
