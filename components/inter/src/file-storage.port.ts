/**
 * Универсальное файловое хранилище контура кооператива.
 * Реализация — адаптер `MinioFileStorageAdapter` поверх MinIO/S3 SDK; токен `INTER_FILE_STORAGE`
 * регистрируется в composition root контроллера. Расширения декларируют свои бакеты декоратором
 * `@UseBucket(spec)` и получают типизированный `InterFileStorageBucket` через DI.
 *
 * Per-bucket изоляция: каждый бакет принадлежит одному расширению, физический путь объектов —
 * `<extension>-<purpose>/<caller-defined-key>` внутри одного MinIO/S3-бакета на кооператив.
 *
 * Подробнее — req «SPEC: файловое хранилище v1».
 */

/** Тело загрузки. ReadableStream — для больших файлов через graphql-upload, Uint8Array — для мелочей. */
export type InterFileStorageBody = ReadableStream<Uint8Array> | Uint8Array;

/**
 * Декларация бакета. Передаётся в `@UseBucket` и далее в `getBucket` порта.
 * Поля валидации (`maxBytes`, `allowedMime`, `metadataSchema`) проверяются адаптером на каждом `put`.
 */
export interface InterFileStorageBucketSpec {
  /** Логическое имя в формате `<extension>:<purpose>`. */
  name: string;
  /** Жёсткий лимит размера на один put (байт). */
  maxBytes: number;
  /** Allowlist MIME-типов. Адаптер сравнивает с `InterFileStoragePutOptions.contentType`. */
  allowedMime: readonly string[];
  /** Схема пользовательских метаданных. Адаптер валидирует на put и возвращает в head. */
  metadataSchema?: Readonly<Record<string, 'required' | 'optional'>>;
  /** TTL по умолчанию для `getReadUrl` (сек). Default — на усмотрение адаптера (рекомендуется 600). */
  defaultUrlTtlSeconds?: number;
}

export interface InterFileStoragePutOptions {
  /** MIME-тип содержимого. Должен быть в `allowedMime` бакета. */
  contentType: string;
  /** Custom user-metadata. Должна соответствовать `metadataSchema` бакета. */
  metadata?: Readonly<Record<string, string>>;
}

export interface InterFileStoragePutResult {
  key: string;
  etag: string;
  size: number;
}

export interface InterFileStorageGetReadUrlOptions {
  /** Перекрывает `defaultUrlTtlSeconds` бакета. */
  ttlSeconds?: number;
}

export interface InterFileStorageObjectMetadata {
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
export interface InterFileStorageBucket {
  /**
   * Загружает объект под caller-defined ключом. Перезапись по тому же ключу — overwrite, как в S3.
   * @throws InterFileStorageObjectTooLargeError — размер превышает `maxBytes` бакета.
   * @throws InterFileStorageMimeRejectedError — `contentType` не входит в `allowedMime`.
   * @throws InterFileStorageMetadataValidationError — отсутствует обязательное поле `metadataSchema`.
   * @throws InterFileStorageBackendUnavailableError — недоступен MinIO/S3.
   */
  put(
    key: string,
    body: InterFileStorageBody,
    opts: InterFileStoragePutOptions,
  ): Promise<InterFileStoragePutResult>;

  /**
   * Возвращает короткоживущий URL для скачивания объекта.
   * В v1 (MinIO) — HMAC-signed URL служебной ручки контроллера; при переходе на нативный S3 —
   * настоящий S3 presigned URL. Контракт строки не меняется.
   * ACL принимается доменом ДО вызова: получив URL, любой держатель может скачать до истечения TTL.
   */
  getReadUrl(
    key: string,
    opts?: InterFileStorageGetReadUrlOptions,
  ): Promise<string>;

  /**
   * Идемпотентное удаление: отсутствие объекта — успех (как DELETE в S3).
   * @throws InterFileStorageBackendUnavailableError — недоступен MinIO/S3.
   */
  delete(key: string): Promise<void>;

  /**
   * Метаданные объекта без скачивания тела.
   * @throws InterFileStorageObjectNotFoundError — объекта нет.
   * @throws InterFileStorageBackendUnavailableError — недоступен MinIO/S3.
   */
  head(key: string): Promise<InterFileStorageObjectMetadata>;
}

/**
 * Корневой порт. Получается через `@Inject(INTER_FILE_STORAGE)` в реестре бакетов контроллера;
 * прикладной код ходит не в порт напрямую, а в `InterFileStorageBucket` от `@UseBucket`.
 */
export interface InterFileStoragePort {
  /**
   * Возвращает типизированный хэндл для данной спеки.
   * Синхронно — обеспечение существования физического бакета у бэкенда происходит отдельно
   * (хук `OnApplicationBootstrap` адаптера, идемпотентно).
   *
   * @throws InterFileStorageBucketNotConfiguredError — спека не валидна.
   */
  getBucket(spec: InterFileStorageBucketSpec): InterFileStorageBucket;
}

// ─── Ошибки ────────────────────────────────────────────────────────────────────

/** Базовый класс ошибок порта. Доменный код ловит конкретные подклассы. */
export class InterFileStorageError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class InterFileStorageObjectNotFoundError extends InterFileStorageError {}
export class InterFileStorageObjectTooLargeError extends InterFileStorageError {}
export class InterFileStorageMimeRejectedError extends InterFileStorageError {}
export class InterFileStorageMetadataValidationError extends InterFileStorageError {}
export class InterFileStorageBackendUnavailableError extends InterFileStorageError {}
export class InterFileStorageBucketNotConfiguredError extends InterFileStorageError {}
