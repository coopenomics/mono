import 'reflect-metadata';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import {
  InterFileStorageBackendUnavailableError,
  InterFileStorageBucketNotConfiguredError,
  InterFileStorageMetadataValidationError,
  InterFileStorageMimeRejectedError,
  InterFileStorageObjectNotFoundError,
  InterFileStorageObjectTooLargeError,
  type InterFileStorageBucketSpec,
} from '@coopenomics/inter';
import type { FileStorageInfrastructureOptions } from './file-storage.config';
import { MinioFileStorageAdapter } from './minio-file-storage.adapter';
import { verifyReadUrl } from './signing';

const BASE_OPTS: FileStorageInfrastructureOptions = {
  endpoint: 'http://minio:9000',
  accessKey: 'AKIA-test',
  secretKey: 'sk-test',
  bucket: 'coop-test',
  signingSecret: 'signing-secret-32-bytes-aaaaaaaa',
  publicBaseUrl: 'https://test.example.org',
};

const SPEC: InterFileStorageBucketSpec = {
  name: 'orders:images',
  maxBytes: 1024,
  allowedMime: ['image/jpeg', 'image/png'],
  metadataSchema: {
    ownerId: 'required',
    altText: 'optional',
  },
};

function makeAdapter(opts: FileStorageInfrastructureOptions = BASE_OPTS): {
  adapter: MinioFileStorageAdapter;
  send: jest.Mock;
} {
  const adapter = new MinioFileStorageAdapter(opts);
  const send = jest.fn();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (adapter as any).s3 = { send };
  return { adapter, send };
}

describe('MinioFileStorageAdapter — getBucket валидация спеки', () => {
  it('отклоняет name без двоеточия', () => {
    const { adapter } = makeAdapter();
    expect(() => adapter.getBucket({ ...SPEC, name: 'no-colon' })).toThrow(
      InterFileStorageBucketNotConfiguredError,
    );
  });

  it('отклоняет неположительный maxBytes', () => {
    const { adapter } = makeAdapter();
    expect(() => adapter.getBucket({ ...SPEC, maxBytes: 0 })).toThrow(
      InterFileStorageBucketNotConfiguredError,
    );
  });

  it('отклоняет пустой allowedMime', () => {
    const { adapter } = makeAdapter();
    expect(() => adapter.getBucket({ ...SPEC, allowedMime: [] })).toThrow(
      InterFileStorageBucketNotConfiguredError,
    );
  });
});

describe('MinioFileStorageAdapter — put', () => {
  it('успешный put передаёт верные Bucket/Key/ContentType/Metadata в PutObjectCommand', async () => {
    const { adapter, send } = makeAdapter();
    send.mockResolvedValueOnce({ ETag: '"abc123"' });
    const bucket = adapter.getBucket(SPEC);

    const body = new Uint8Array([1, 2, 3, 4]);
    const result = await bucket.put('orders/42/main.jpg', body, {
      contentType: 'image/jpeg',
      metadata: { ownerId: 'u-1' },
    });

    expect(send).toHaveBeenCalledTimes(1);
    const cmd = send.mock.calls[0][0] as PutObjectCommand;
    expect(cmd).toBeInstanceOf(PutObjectCommand);
    expect(cmd.input.Bucket).toBe('coop-test');
    expect(cmd.input.Key).toBe('orders-images/orders/42/main.jpg');
    expect(cmd.input.ContentType).toBe('image/jpeg');
    expect(cmd.input.ContentLength).toBe(4);
    expect(cmd.input.Metadata).toEqual({ ownerId: 'u-1' });

    expect(result.key).toBe('orders/42/main.jpg');
    expect(result.etag).toBe('abc123');
    expect(result.size).toBe(4);
  });

  it('отклоняет put с неподходящим MIME без обращения к S3', async () => {
    const { adapter, send } = makeAdapter();
    const bucket = adapter.getBucket(SPEC);
    await expect(
      bucket.put('orders/x/main.exe', new Uint8Array([0]), {
        contentType: 'application/octet-stream',
        metadata: { ownerId: 'u-1' },
      }),
    ).rejects.toBeInstanceOf(InterFileStorageMimeRejectedError);
    expect(send).not.toHaveBeenCalled();
  });

  it('отклоняет put сверх maxBytes (Uint8Array) без обращения к S3', async () => {
    const { adapter, send } = makeAdapter();
    const bucket = adapter.getBucket(SPEC);
    const body = new Uint8Array(SPEC.maxBytes + 1);
    await expect(
      bucket.put('big.jpg', body, { contentType: 'image/jpeg', metadata: { ownerId: 'u-1' } }),
    ).rejects.toBeInstanceOf(InterFileStorageObjectTooLargeError);
    expect(send).not.toHaveBeenCalled();
  });

  it('отклоняет put сверх maxBytes (ReadableStream) до отправки', async () => {
    const { adapter, send } = makeAdapter();
    const bucket = adapter.getBucket(SPEC);

    const chunks: Uint8Array[] = [
      new Uint8Array(SPEC.maxBytes - 100),
      new Uint8Array(200), // overshoot at second chunk
    ];
    const stream = makeWebStream(chunks) as unknown as ReadableStream<Uint8Array>;

    await expect(
      bucket.put('big-stream.jpg', stream, {
        contentType: 'image/jpeg',
        metadata: { ownerId: 'u-1' },
      }),
    ).rejects.toBeInstanceOf(InterFileStorageObjectTooLargeError);
    expect(send).not.toHaveBeenCalled();
  });

  it('отклоняет put без обязательного metadata-поля', async () => {
    const { adapter, send } = makeAdapter();
    const bucket = adapter.getBucket(SPEC);
    await expect(
      bucket.put('x.jpg', new Uint8Array([1]), { contentType: 'image/jpeg', metadata: {} }),
    ).rejects.toBeInstanceOf(InterFileStorageMetadataValidationError);
    expect(send).not.toHaveBeenCalled();
  });

  it('путь успешного потока — стрим читается, размер контролируется, S3 получает Buffer', async () => {
    const { adapter, send } = makeAdapter();
    send.mockResolvedValueOnce({ ETag: '"e1"' });
    const bucket = adapter.getBucket(SPEC);

    const stream = makeWebStream([
      new Uint8Array([10, 20]),
      new Uint8Array([30]),
    ]) as unknown as ReadableStream<Uint8Array>;
    const r = await bucket.put('s.jpg', stream, {
      contentType: 'image/jpeg',
      metadata: { ownerId: 'u' },
    });
    expect(r.size).toBe(3);
    const cmd = send.mock.calls[0][0] as PutObjectCommand;
    const body = cmd.input.Body as Buffer;
    expect(body.length).toBe(3);
    expect(body[0]).toBe(10);
    expect(body[2]).toBe(30);
  });

  it('оборачивает backend-ошибку put в BackendUnavailableError', async () => {
    const { adapter, send } = makeAdapter();
    send.mockRejectedValueOnce(new Error('connection refused'));
    const bucket = adapter.getBucket(SPEC);

    await expect(
      bucket.put('x.jpg', new Uint8Array([1]), {
        contentType: 'image/jpeg',
        metadata: { ownerId: 'u' },
      }),
    ).rejects.toBeInstanceOf(InterFileStorageBackendUnavailableError);
  });
});

describe('MinioFileStorageAdapter — head', () => {
  it('возвращает метаданные при успешном HEAD', async () => {
    const { adapter, send } = makeAdapter();
    const lastModified = new Date('2026-04-23T10:00:00Z');
    send.mockResolvedValueOnce({
      ContentLength: 42,
      ETag: '"deadbeef"',
      ContentType: 'image/png',
      LastModified: lastModified,
      Metadata: { ownerid: 'u-1' },
    });

    const bucket = adapter.getBucket(SPEC);
    const r = await bucket.head('a/b.png');

    expect((send.mock.calls[0][0] as HeadObjectCommand).input.Key).toBe('orders-images/a/b.png');
    expect(r.size).toBe(42);
    expect(r.etag).toBe('deadbeef');
    expect(r.contentType).toBe('image/png');
    expect(r.lastModified).toEqual(lastModified);
    expect(r.metadata.ownerid).toBe('u-1');
  });

  it('бросает ObjectNotFoundError при S3-ошибке NotFound', async () => {
    const { adapter, send } = makeAdapter();
    const err = Object.assign(new Error('not found'), {
      name: 'NotFound',
      $metadata: { httpStatusCode: 404 },
    });
    send.mockRejectedValueOnce(err);

    const bucket = adapter.getBucket(SPEC);
    await expect(bucket.head('missing.jpg')).rejects.toBeInstanceOf(
      InterFileStorageObjectNotFoundError,
    );
  });

  it('бросает ObjectNotFoundError при ошибке NoSuchKey', async () => {
    const { adapter, send } = makeAdapter();
    const err = Object.assign(new Error('no such key'), { name: 'NoSuchKey' });
    send.mockRejectedValueOnce(err);

    const bucket = adapter.getBucket(SPEC);
    await expect(bucket.head('missing.jpg')).rejects.toBeInstanceOf(
      InterFileStorageObjectNotFoundError,
    );
  });

  it('оборачивает прочие backend-ошибки в BackendUnavailableError', async () => {
    const { adapter, send } = makeAdapter();
    send.mockRejectedValueOnce(new Error('timeout'));
    const bucket = adapter.getBucket(SPEC);
    await expect(bucket.head('x.jpg')).rejects.toBeInstanceOf(
      InterFileStorageBackendUnavailableError,
    );
  });
});

describe('MinioFileStorageAdapter — delete', () => {
  it('успешный delete вызывает DeleteObjectCommand с правильным Key', async () => {
    const { adapter, send } = makeAdapter();
    send.mockResolvedValueOnce({});
    const bucket = adapter.getBucket(SPEC);
    await bucket.delete('a/b.jpg');
    const cmd = send.mock.calls[0][0] as DeleteObjectCommand;
    expect(cmd).toBeInstanceOf(DeleteObjectCommand);
    expect(cmd.input.Bucket).toBe('coop-test');
    expect(cmd.input.Key).toBe('orders-images/a/b.jpg');
  });

  it('оборачивает backend-ошибку delete в BackendUnavailableError', async () => {
    const { adapter, send } = makeAdapter();
    send.mockRejectedValueOnce(new Error('500'));
    const bucket = adapter.getBucket(SPEC);
    await expect(bucket.delete('x.jpg')).rejects.toBeInstanceOf(
      InterFileStorageBackendUnavailableError,
    );
  });
});

describe('MinioFileStorageAdapter — getReadUrl', () => {
  it('возвращает URL верной структуры с подписью, проходящей verifyReadUrl', async () => {
    const { adapter } = makeAdapter();
    const bucket = adapter.getBucket(SPEC);

    const url = await bucket.getReadUrl('orders/42/main.jpg', { ttlSeconds: 60 });
    const parsed = new URL(url);
    expect(parsed.origin).toBe('https://test.example.org');
    expect(parsed.pathname).toBe('/api/storage/orders-images/orders/42/main.jpg');

    const exp = Number(parsed.searchParams.get('exp'));
    const sig = parsed.searchParams.get('sig')!;
    const now = Math.floor(Date.now() / 1000);
    expect(exp).toBeGreaterThan(now);
    expect(exp).toBeLessThanOrEqual(now + 61);
    expect(sig).toMatch(/^[0-9a-f]{64}$/);

    const ok = verifyReadUrl({
      bucket: 'orders-images',
      key: 'orders/42/main.jpg',
      expUnix: exp,
      sig,
      secret: BASE_OPTS.signingSecret,
    });
    expect(ok).toBe(true);
  });

  it('берёт TTL из defaultUrlTtlSeconds бакета, если не передан', async () => {
    const { adapter } = makeAdapter();
    const bucket = adapter.getBucket({ ...SPEC, defaultUrlTtlSeconds: 30 });
    const url = await bucket.getReadUrl('x.jpg');
    const exp = Number(new URL(url).searchParams.get('exp'));
    const now = Math.floor(Date.now() / 1000);
    expect(exp - now).toBeGreaterThanOrEqual(28);
    expect(exp - now).toBeLessThanOrEqual(31);
  });

  it('экранирует ключ посегментно, сохраняя слэши как разделители', async () => {
    const { adapter } = makeAdapter();
    const bucket = adapter.getBucket(SPEC);
    const url = await bucket.getReadUrl('a b/c?d=e/f.jpg');
    const parsed = new URL(url);
    expect(parsed.pathname).toBe('/api/storage/orders-images/a%20b/c%3Fd%3De/f.jpg');
  });
});

describe('MinioFileStorageAdapter — onApplicationBootstrap', () => {
  it('пропускает CreateBucket, если HeadBucket прошёл', async () => {
    const { adapter, send } = makeAdapter();
    send.mockResolvedValueOnce({}); // HeadBucket OK
    await adapter.onApplicationBootstrap();
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toBeInstanceOf(HeadBucketCommand);
  });

  it('создаёт бакет, если HeadBucket вернул 404', async () => {
    const { adapter, send } = makeAdapter();
    const notFound = Object.assign(new Error('not found'), {
      name: 'NotFound',
      $metadata: { httpStatusCode: 404 },
    });
    send.mockRejectedValueOnce(notFound).mockResolvedValueOnce({});

    await adapter.onApplicationBootstrap();

    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[0][0]).toBeInstanceOf(HeadBucketCommand);
    expect(send.mock.calls[1][0]).toBeInstanceOf(CreateBucketCommand);
  });

  it('бросает BackendUnavailableError, если HeadBucket упал не на 404', async () => {
    const { adapter, send } = makeAdapter();
    send.mockRejectedValueOnce(new Error('connection refused'));
    await expect(adapter.onApplicationBootstrap()).rejects.toBeInstanceOf(
      InterFileStorageBackendUnavailableError,
    );
  });
});

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeWebStream(chunks: Uint8Array[]): {
  getReader: () => { read: () => Promise<{ value?: Uint8Array; done: boolean }>; cancel: () => Promise<void> };
} {
  let i = 0;
  return {
    getReader() {
      return {
        async read() {
          if (i >= chunks.length) return { value: undefined, done: true };
          const value = chunks[i++];
          return { value, done: false };
        },
        async cancel() {
          /* noop */
        },
      };
    },
  };
}
