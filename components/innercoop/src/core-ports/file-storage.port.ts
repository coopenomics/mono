/**
 * Универсальное файловое хранилище контура кооператива.
 * Реализация — адаптер `MinioFileStorageAdapter` поверх MinIO/S3 SDK; токен `FILE_STORAGE_PORT`
 * регистрируется в composition root контроллера. Расширения декларируют свои бакеты декоратором
 * `@UseBucket(spec)` и получают типизированный `InnerFileStorageBucket` через DI.
 *
 * Per-bucket изоляция: каждый бакет принадлежит одному расширению, физический путь объектов —
 * `<extension>-<purpose>/<caller-defined-key>` внутри одного MinIO/S3-бакета на кооператив.
 *
 * Подробнее — req «SPEC: файловое хранилище v1».
 */

/** Тело загрузки. ReadableStream — для больших файлов через graphql-upload, Uint8Array — для мелочей. */
export type InnerFileStorageBody = ReadableStream<Uint8Array> | Uint8Array;

/**
 * Декларация бакета. Передаётся в `@UseBucket` и далее в `getBucket` порта.
 * Поля валидации (`maxBytes`, `allowedMime`, `metadataSchema`) проверяются адаптером на каждом `put`.
 */
export interface InnerFileStorageBucketSpec {
  /** Логическое имя в формате `<extension>:<purpose>`. */
  name: string;
  /** Жёсткий лимит размера на один put (байт). */
  maxBytes: number;
  /** Allowlist MIME-типов. Адаптер сравнивает с `InnerFileStoragePutOptions.contentType`. */
  allowedMime: readonly string[];
  /** Схема пользовательских метаданных. Адаптер валидирует на put и возвращает в head. */
  metadataSchema?: Readonly<Record<string, 'required' | 'optional'>>;
  /** TTL по умолчанию для `getReadUrl` (сек). Default — на усмотрение адаптера (рекомендуется 600). */
  defaultUrlTtlSeconds?: number;
}

export interface InnerFileStoragePutOptions {
  /** MIME-тип содержимого. Должен быть в `allowedMime` бакета. */
  contentType: string;
  /** Custom user-metadata. Должна соответствовать `metadataSchema` бакета. */
  metadata?: Readonly<Record<string, string>>;
}

export interface InnerFileStoragePutResult {
  key: string;
  etag: string;
  size: number;
}

export interface InnerFileStorageGetReadUrlOptions {
  /** Перекрывает `defaultUrlTtlSeconds` бакета. */
  ttlSeconds?: number;
}

export interface InnerFileStorageObjectMetadata {
  size: number;
  etag: string;
  contentType: string;
  lastModified: Date;
  metadata: Readonly<Record<string, string>>;
}

/**
 * Хэндл одного зарегистрированного бакета. Расширение получает его через DI и работает только с ним.
 * Префикс `<extension>-<purpose>` инкапсулирован адаптером — наружу ключи остаются caller-defined.
 */
export interface InnerFileStorageBucket {
  /**
   * Загружает объект под caller-defined ключом. Перезапись по тому же ключу — overwrite, как в S3.
   * @throws InnerFileStorageObjectTooLargeError — размер превышает `maxBytes` бакета.
   * @throws InnerFileStorageMimeRejectedError — `contentType` не входит в `allowedMime`.
   * @throws InnerFileStorageMetadataValidationError — отсутствует обязательное поле `metadataSchema`.
   * @throws InnerFileStorageBackendUnavailableError — недоступен MinIO/S3.
   */
  put(
    key: string,
    body: InnerFileStorageBody,
    opts: InnerFileStoragePutOptions,
  ): Promise<InnerFileStoragePutResult>;

  /**
   * Возвращает короткоживущий URL для скачивания объекта.
   * В v1 (MinIO) — HMAC-signed URL служебной ручки контроллера; при переходе на нативный S3 —
   * настоящий S3 presigned URL. Контракт строки не меняется.
   * ACL принимается доменом ДО вызова: получив URL, любой держатель может скачать до истечения TTL.
   */
  getReadUrl(
    key: string,
    opts?: InnerFileStorageGetReadUrlOptions,
  ): Promise<string>;

  /**
   * Идемпотентное удаление: отсутствие объекта — успех (как DELETE в S3).
   * @throws InnerFileStorageBackendUnavailableError — недоступен MinIO/S3.
   */
  delete(key: string): Promise<void>;

  /**
   * Метаданные объекта без скачивания тела.
   * @throws InnerFileStorageObjectNotFoundError — объекта нет.
   * @throws InnerFileStorageBackendUnavailableError — недоступен MinIO/S3.
   */
  head(key: string): Promise<InnerFileStorageObjectMetadata>;
}

/**
 * Корневой порт. Получается через `@Inject(FILE_STORAGE_PORT)` в реестре бакетов контроллера;
 * прикладной код ходит не в порт напрямую, а в `InnerFileStorageBucket` от `@UseBucket`.
 */
export interface IFileStoragePort {
  /**
   * Возвращает типизированный хэндл для данной спеки.
   * Синхронно — обеспечение существования физического бакета у бэкенда происходит отдельно
   * (хук `OnApplicationBootstrap` адаптера, идемпотентно).
   *
   * @throws InnerFileStorageBucketNotConfiguredError — спека не валидна.
   */
  getBucket(spec: InnerFileStorageBucketSpec): InnerFileStorageBucket;
}

// ─── Ошибки ────────────────────────────────────────────────────────────────────

/** Базовый класс ошибок порта. Доменный код ловит конкретные подклассы. */
export class InnerFileStorageError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class InnerFileStorageObjectNotFoundError extends InnerFileStorageError {}
export class InnerFileStorageObjectTooLargeError extends InnerFileStorageError {}
export class InnerFileStorageMimeRejectedError extends InnerFileStorageError {}
export class InnerFileStorageMetadataValidationError extends InnerFileStorageError {}
export class InnerFileStorageBackendUnavailableError extends InnerFileStorageError {}
export class InnerFileStorageBucketNotConfiguredError extends InnerFileStorageError {}

// ─── DI-токен ──────────────────────────────────────────────────────────────────

/**
 * Универсальное файловое хранилище контура кооператива (MinIO в v1, S3 в v2). Провайдер — ядро.
 * Реализацию подставляет composition root (`InnercoopBridgeModule`).
 */
export const FILE_STORAGE_PORT = Symbol.for('Innercoop.CorePort.FileStorage');
