/**
 * Конфигурация подключения к MinIO/S3 и подписания read-URL.
 * Передаётся в `FileStorageInfrastructureModule.forRoot(options)`.
 */
export interface FileStorageInfrastructureOptions {
  /** URL S3-совместимого бэкенда. Для MinIO — `http://minio:9000`. Пусто/undefined = file storage отключён (no-op). */
  endpoint?: string;
  accessKey: string;
  secretKey: string;
  /** Имя физического бакета на сервере (например, `coop-voskhod`). */
  bucket: string;
  /** Секрет для HMAC-подписи read-URL служебной ручки контроллера. */
  signingSecret: string;
  /** База публичного URL контроллера (например, `https://voskhod.example.org`). */
  publicBaseUrl: string;
  /** AWS region. Для MinIO любое непустое значение. По умолчанию `us-east-1`. */
  region?: string;
  /** Path-style addressing (true для MinIO, false для AWS S3). По умолчанию true. */
  forcePathStyle?: boolean;
  /** TTL по умолчанию для read-URL (сек). Перекрывается `BucketSpec.defaultUrlTtlSeconds`. По умолчанию 600. */
  defaultUrlTtlSeconds?: number;
}

export const FILE_STORAGE_OPTIONS = Symbol.for('FileStorage.Options');

export const FILE_STORAGE_DEFAULT_URL_TTL_SECONDS = 600;
