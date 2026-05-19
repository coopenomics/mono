import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import {
  InterFileStorageBackendUnavailableError,
  InterFileStorageBucketNotConfiguredError,
  InterFileStorageMetadataValidationError,
  InterFileStorageMimeRejectedError,
  InterFileStorageObjectNotFoundError,
  InterFileStorageObjectTooLargeError,
  type InterFileStorageBody,
  type InterFileStorageBucket,
  type InterFileStorageBucketSpec,
  type InterFileStorageGetReadUrlOptions,
  type InterFileStorageObjectMetadata,
  type InterFileStoragePort,
  type InterFileStoragePutOptions,
  type InterFileStoragePutResult,
} from '@coopenomics/inter';
import { BucketRegistry } from './bucket-registry';
import {
  FILE_STORAGE_DEFAULT_URL_TTL_SECONDS,
  FILE_STORAGE_OPTIONS,
  type FileStorageInfrastructureOptions,
} from './file-storage.config';
import { signReadUrl } from './signing';

/**
 * Адаптер `InterFileStoragePort` поверх MinIO/S3. Реализация одна и та же для обоих —
 * различается только `endpoint` и `forcePathStyle`. На bootstrap идемпотентно создаёт
 * физический бакет, дальше отдаёт `InterFileStorageBucket`-хэндлы по спекам.
 *
 * URL чтения формируется на собственный домен контроллера (служебная ручка `/api/storage/...`),
 * подписывается HMAC-SHA256 секретом из конфига. При переходе на нативный S3 здесь же
 * можно начать возвращать настоящие S3 presigned URL — контракт строки не меняется.
 */
@Injectable()
export class MinioFileStorageAdapter implements InterFileStoragePort, OnApplicationBootstrap {
  private readonly logger = new Logger(MinioFileStorageAdapter.name);
  private readonly s3: S3Client | null;
  private readonly enabled: boolean;

  constructor(
    @Inject(FILE_STORAGE_OPTIONS)
    private readonly opts: FileStorageInfrastructureOptions,
  ) {
    this.enabled = typeof opts.endpoint === 'string' && opts.endpoint.length > 0;
    this.s3 = this.enabled
      ? new S3Client({
          endpoint: opts.endpoint,
          region: opts.region ?? 'us-east-1',
          credentials: {
            accessKeyId: opts.accessKey,
            secretAccessKey: opts.secretKey,
          },
          forcePathStyle: opts.forcePathStyle ?? true,
        })
      : null;
  }

  async onApplicationBootstrap(): Promise<void> {
    if (!this.enabled || !this.s3) {
      this.logger.warn(
        'File storage не сконфигурирован (MINIO_ENDPOINT пуст) — модуль стартует в no-op режиме. ' +
          'Загрузка/чтение файлов будут отклонены до настройки бэкенда.',
      );
      return;
    }
    await this.ensureBucketExists();
    const registered = BucketRegistry.list();
    this.logger.log(
      `File storage готов. Физический бакет '${this.opts.bucket}', эндпоинт '${this.opts.endpoint}'. ` +
        `Зарегистрировано бакетов через @UseBucket: ${registered.length}` +
        (registered.length > 0
          ? ` (${registered.map((r) => `${r.cls.name}→${r.spec.name}`).join(', ')})`
          : ''),
    );
  }

  private assertEnabled(): S3Client {
    if (!this.enabled || !this.s3) {
      throw new InterFileStorageBackendUnavailableError(
        'File storage не сконфигурирован: MINIO_ENDPOINT пуст. Задайте переменную окружения, чтобы включить загрузку/чтение файлов.',
      );
    }
    return this.s3;
  }

  private async ensureBucketExists(): Promise<void> {
    const s3 = this.assertEnabled();
    try {
      await s3.send(new HeadBucketCommand({ Bucket: this.opts.bucket }));
      return;
    } catch (e) {
      if (!isNotFound(e)) {
        throw new InterFileStorageBackendUnavailableError(
          `HeadBucket(${this.opts.bucket}) не удался: ${getMessage(e)}`,
          { cause: asError(e) },
        );
      }
    }
    try {
      await s3.send(new CreateBucketCommand({ Bucket: this.opts.bucket }));
      this.logger.log(`Создан физический бакет '${this.opts.bucket}'`);
    } catch (e) {
      throw new InterFileStorageBackendUnavailableError(
        `CreateBucket(${this.opts.bucket}) не удался: ${getMessage(e)}`,
        { cause: asError(e) },
      );
    }
  }

  getBucket(spec: InterFileStorageBucketSpec): InterFileStorageBucket {
    const s3 = this.assertEnabled();
    validateSpec(spec);
    return new MinioBucketHandle(s3, this.opts, spec);
  }

  /**
   * Внутренний fetch для HTTP-ручки `/api/storage/:bucket/:key` (E59-4).
   * `physicalKey` — это уже собранный ключ S3-объекта вида `<extension>-<purpose>/<caller-key>`.
   * @throws InterFileStorageObjectNotFoundError, InterFileStorageBackendUnavailableError
   */
  async fetchObjectForReadProxy(physicalKey: string): Promise<FileStorageObjectStream> {
    const s3 = this.assertEnabled();
    try {
      const r = await s3.send(
        new GetObjectCommand({ Bucket: this.opts.bucket, Key: physicalKey }),
      );
      return {
        stream: r.Body as NodeJS.ReadableStream,
        size: r.ContentLength ?? 0,
        contentType: r.ContentType ?? 'application/octet-stream',
        lastModified: r.LastModified ?? new Date(0),
      };
    } catch (e) {
      if (isNotFound(e)) {
        throw new InterFileStorageObjectNotFoundError(`Объект '${physicalKey}' не найден`);
      }
      throw wrapBackendError(e, `getObject '${physicalKey}'`);
    }
  }
}

class MinioBucketHandle implements InterFileStorageBucket {
  private readonly publicBucketName: string;
  private readonly defaultTtlSeconds: number;

  constructor(
    private readonly s3: S3Client,
    private readonly opts: FileStorageInfrastructureOptions,
    private readonly spec: InterFileStorageBucketSpec,
  ) {
    this.publicBucketName = spec.name.replace(/:/g, '-');
    this.defaultTtlSeconds =
      spec.defaultUrlTtlSeconds ?? opts.defaultUrlTtlSeconds ?? FILE_STORAGE_DEFAULT_URL_TTL_SECONDS;
  }

  private physicalKey(key: string): string {
    return `${this.publicBucketName}/${key}`;
  }

  async put(
    key: string,
    body: InterFileStorageBody,
    opts: InterFileStoragePutOptions,
  ): Promise<InterFileStoragePutResult> {
    if (!this.spec.allowedMime.includes(opts.contentType)) {
      throw new InterFileStorageMimeRejectedError(
        `MIME '${opts.contentType}' не входит в allowedMime бакета '${this.spec.name}'`,
      );
    }
    this.validateMetadata(opts.metadata);
    const buffer = await materializeAndCheckSize(body, this.spec.maxBytes, this.spec.name);

    try {
      const r = await this.s3.send(
        new PutObjectCommand({
          Bucket: this.opts.bucket,
          Key: this.physicalKey(key),
          Body: buffer,
          ContentType: opts.contentType,
          ContentLength: buffer.byteLength,
          Metadata: opts.metadata as Record<string, string> | undefined,
        }),
      );
      return {
        key,
        etag: stripQuotes(r.ETag) ?? '',
        size: buffer.byteLength,
      };
    } catch (e) {
      throw wrapBackendError(e, `put '${this.spec.name}/${key}'`);
    }
  }

  async getReadUrl(key: string, opts?: InterFileStorageGetReadUrlOptions): Promise<string> {
    const ttl = opts?.ttlSeconds ?? this.defaultTtlSeconds;
    const exp = Math.floor(Date.now() / 1000) + ttl;
    const sig = signReadUrl({
      bucket: this.publicBucketName,
      key,
      expUnix: exp,
      secret: this.opts.signingSecret,
    });
    const base = this.opts.publicBaseUrl.replace(/\/+$/, '');
    return `${base}/api/storage/${encodeURIComponent(this.publicBucketName)}/${encodeKeyForPath(key)}?exp=${exp}&sig=${sig}`;
  }

  async delete(key: string): Promise<void> {
    try {
      await this.s3.send(
        new DeleteObjectCommand({ Bucket: this.opts.bucket, Key: this.physicalKey(key) }),
      );
    } catch (e) {
      // S3 DeleteObject идемпотентен — отсутствие объекта не ошибка. Сюда попадают только
      // реальные backend-фейлы.
      throw wrapBackendError(e, `delete '${this.spec.name}/${key}'`);
    }
  }

  async head(key: string): Promise<InterFileStorageObjectMetadata> {
    try {
      const r = await this.s3.send(
        new HeadObjectCommand({ Bucket: this.opts.bucket, Key: this.physicalKey(key) }),
      );
      return {
        size: r.ContentLength ?? 0,
        etag: stripQuotes(r.ETag) ?? '',
        contentType: r.ContentType ?? 'application/octet-stream',
        lastModified: r.LastModified ?? new Date(0),
        metadata: r.Metadata ?? {},
      };
    } catch (e) {
      if (isNotFound(e)) {
        throw new InterFileStorageObjectNotFoundError(
          `Объект '${this.spec.name}/${key}' не найден`,
        );
      }
      throw wrapBackendError(e, `head '${this.spec.name}/${key}'`);
    }
  }

  private validateMetadata(metadata?: Readonly<Record<string, string>>): void {
    if (!this.spec.metadataSchema) return;
    for (const [field, kind] of Object.entries(this.spec.metadataSchema)) {
      if (kind !== 'required') continue;
      const value = metadata?.[field];
      if (!value) {
        throw new InterFileStorageMetadataValidationError(
          `Метаданное '${field}' обязательно для бакета '${this.spec.name}'`,
        );
      }
    }
  }
}

/**
 * Результат внутреннего fetch для HTTP-ручки `/api/storage/...`.
 * Не часть публичного `InterFileStoragePort` — только для proxy-стрима внутри контроллера.
 */
export interface FileStorageObjectStream {
  stream: NodeJS.ReadableStream;
  size: number;
  contentType: string;
  lastModified: Date;
}

function validateSpec(spec: InterFileStorageBucketSpec): void {
  if (!spec.name || !spec.name.includes(':')) {
    throw new InterFileStorageBucketNotConfiguredError(
      `BucketSpec.name должен иметь формат '<extension>:<purpose>', получено '${spec.name}'`,
    );
  }
  if (!Number.isFinite(spec.maxBytes) || spec.maxBytes <= 0) {
    throw new InterFileStorageBucketNotConfiguredError(
      `BucketSpec.maxBytes должно быть положительным конечным числом, получено ${spec.maxBytes}`,
    );
  }
  if (!spec.allowedMime || spec.allowedMime.length === 0) {
    throw new InterFileStorageBucketNotConfiguredError(
      `BucketSpec.allowedMime должен содержать хотя бы один MIME-тип`,
    );
  }
}

async function materializeAndCheckSize(
  body: InterFileStorageBody,
  maxBytes: number,
  specName: string,
): Promise<Buffer> {
  if (body instanceof Uint8Array) {
    if (body.byteLength > maxBytes) {
      throw new InterFileStorageObjectTooLargeError(
        `Размер ${body.byteLength} байт превышает лимит ${maxBytes} бакета '${specName}'`,
      );
    }
    return Buffer.from(body);
  }
  // Web ReadableStream<Uint8Array> — duck-typed, чтобы не зависеть от глобального типа `ReadableStream`.
  if (
    typeof body === 'object' &&
    body !== null &&
    'getReader' in body &&
    typeof (body as { getReader: unknown }).getReader === 'function'
  ) {
    const reader = (body as { getReader: () => StreamReader }).getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value && value.byteLength > 0) {
        total += value.byteLength;
        if (total > maxBytes) {
          // Освобождаем reader, чтобы не оставлять стрим висящим.
          try {
            await reader.cancel();
          } catch {
            // ignore
          }
          throw new InterFileStorageObjectTooLargeError(
            `Размер тела превышает лимит ${maxBytes} бакета '${specName}'`,
          );
        }
        chunks.push(value);
      }
    }
    return Buffer.concat(chunks);
  }
  throw new InterFileStorageBackendUnavailableError(
    `Неподдерживаемый тип тела для бакета '${specName}'`,
  );
}

interface StreamReader {
  read(): Promise<{ value?: Uint8Array; done: boolean }>;
  cancel(): Promise<void>;
}

function isNotFound(e: unknown): boolean {
  if (typeof e !== 'object' || e === null) return false;
  const ex = e as {
    name?: string;
    Code?: string;
    $metadata?: { httpStatusCode?: number };
  };
  if (ex.name === 'NotFound' || ex.name === 'NoSuchKey' || ex.name === 'NoSuchBucket') return true;
  if (ex.Code === 'NotFound' || ex.Code === 'NoSuchKey' || ex.Code === 'NoSuchBucket') return true;
  if (ex.$metadata?.httpStatusCode === 404) return true;
  return false;
}

function wrapBackendError(e: unknown, op: string): InterFileStorageBackendUnavailableError {
  return new InterFileStorageBackendUnavailableError(`${op}: ${getMessage(e)}`, {
    cause: asError(e),
  });
}

function getMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  return 'unknown error';
}

function asError(e: unknown): Error | undefined {
  return e instanceof Error ? e : undefined;
}

function stripQuotes(s: string | undefined): string | undefined {
  if (!s) return s;
  return s.replace(/^"|"$/g, '');
}

function encodeKeyForPath(key: string): string {
  // '/' — разделитель сегментов URL, остальное per-segment encodeURIComponent.
  return key.split('/').map(encodeURIComponent).join('/');
}
