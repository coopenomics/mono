import 'reflect-metadata';
import { execSync } from 'child_process';
import { Readable } from 'stream';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import {
  InterFileStorageMetadataValidationError,
  InterFileStorageMimeRejectedError,
  InterFileStorageObjectNotFoundError,
  InterFileStorageObjectTooLargeError,
  type InterFileStorageBucketSpec,
} from '@coopenomics/inter';
import {
  FileStorageHttpController,
  FILE_STORAGE_OPTIONS,
  type FileStorageInfrastructureOptions,
  MinioFileStorageAdapter,
  signReadUrl,
} from '../../src/infrastructure/file-storage';

const ENDPOINT = process.env.FILE_STORAGE_TEST_MINIO_ENDPOINT ?? 'http://localhost:9100';
const ACCESS_KEY = process.env.FILE_STORAGE_TEST_MINIO_ACCESS_KEY ?? 'testuser';
const SECRET_KEY = process.env.FILE_STORAGE_TEST_MINIO_SECRET_KEY ?? 'testpassword';
const BUCKET = process.env.FILE_STORAGE_TEST_BUCKET ?? `coop-test-${Date.now()}`;
const SIGNING_SECRET = 'integration-signing-secret-aaaaaaaaaaaaaaaa';
const PUBLIC_BASE_URL = 'https://test.example.org';

const SPEC: InterFileStorageBucketSpec = {
  name: 'orders:images',
  maxBytes: 10 * 1024,
  allowedMime: ['image/jpeg', 'image/png', 'application/pdf'],
  metadataSchema: {
    ownerId: 'required',
    altText: 'optional',
  },
  defaultUrlTtlSeconds: 60,
};

/** Sync-проверка доступности MinIO. Решение `it` vs `it.skip` принимается до describe(). */
function probeMinioSync(): boolean {
  try {
    execSync(`curl -fsS --max-time 2 ${ENDPOINT}/minio/health/live`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const minioReachable = probeMinioSync();
if (!minioReachable) {
  // eslint-disable-next-line no-console
  console.warn(
    `[integration] MinIO недоступен на ${ENDPOINT} — тесты пропущены. ` +
      `Подними: docker compose -f tests/file-storage/docker-compose.yml up -d`,
  );
}

const itLive = (name: string, fn: jest.ProvidesCallback, timeout?: number) =>
  (minioReachable ? it : it.skip)(name, fn, timeout);

describe('file-storage integration (real MinIO)', () => {
  let adapter: MinioFileStorageAdapter;
  let app: INestApplication;
  const opts: FileStorageInfrastructureOptions = {
    endpoint: ENDPOINT,
    accessKey: ACCESS_KEY,
    secretKey: SECRET_KEY,
    bucket: BUCKET,
    signingSecret: SIGNING_SECRET,
    publicBaseUrl: PUBLIC_BASE_URL,
    forcePathStyle: true,
  };

  beforeAll(async () => {
    if (!minioReachable) return;
    adapter = new MinioFileStorageAdapter(opts);
    await adapter.onApplicationBootstrap();

    const moduleRef = await Test.createTestingModule({
      controllers: [FileStorageHttpController],
      providers: [
        { provide: FILE_STORAGE_OPTIONS, useValue: opts },
        { provide: MinioFileStorageAdapter, useValue: adapter },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  }, 60_000);

  afterAll(async () => {
    if (app) await app.close();
  });

  itLive('put → head → getReadUrl → GET → bytes равны (image)', async () => {
    const bucket = adapter.getBucket(SPEC);
    const payload = Buffer.from(jpegFixture());
    await bucket.put('orders/42/main.jpg', payload, {
      contentType: 'image/jpeg',
      metadata: { ownerId: 'u-1', altText: 'demo' },
    });

    const meta = await bucket.head('orders/42/main.jpg');
    expect(meta.size).toBe(payload.length);
    expect(meta.contentType).toBe('image/jpeg');
    expect(meta.metadata.ownerid ?? meta.metadata.ownerId).toBe('u-1');

    const url = await bucket.getReadUrl('orders/42/main.jpg', { ttlSeconds: 30 });
    const parsed = new URL(url);
    const res = await request(app.getHttpServer())
      .get(parsed.pathname)
      .query({ exp: parsed.searchParams.get('exp')!, sig: parsed.searchParams.get('sig')! })
      .buffer(true)
      .parse((response, cb) => {
        const chunks: Buffer[] = [];
        response.on('data', (c) => chunks.push(c));
        response.on('end', () => cb(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('image/jpeg');
    expect((res.body as Buffer).equals(payload)).toBe(true);
  }, 30_000);

  itLive('put PDF среднего размера через стрим, читается обратно идентично', async () => {
    const bucket = adapter.getBucket(SPEC);
    const payload = Buffer.alloc(8 * 1024); // 8 KiB
    for (let i = 0; i < payload.length; i++) payload[i] = i % 251;
    const stream = bufferToWebStream(payload);
    await bucket.put('reports/r-1/r1.pdf', stream, {
      contentType: 'application/pdf',
      metadata: { ownerId: 'u-2' },
    });

    const meta = await bucket.head('reports/r-1/r1.pdf');
    expect(meta.size).toBe(payload.length);

    const url = await bucket.getReadUrl('reports/r-1/r1.pdf', { ttlSeconds: 30 });
    const parsed = new URL(url);
    const res = await request(app.getHttpServer())
      .get(parsed.pathname)
      .query({ exp: parsed.searchParams.get('exp')!, sig: parsed.searchParams.get('sig')! })
      .buffer(true)
      .parse((response, cb) => {
        const chunks: Buffer[] = [];
        response.on('data', (c) => chunks.push(c));
        response.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);
    expect((res.body as Buffer).equals(payload)).toBe(true);
  }, 30_000);

  itLive('delete идемпотентен (повтор на отсутствующий — успех)', async () => {
    const bucket = adapter.getBucket(SPEC);
    await bucket.put('to-delete.jpg', Buffer.from([1, 2, 3]), {
      contentType: 'image/jpeg',
      metadata: { ownerId: 'u' },
    });
    await bucket.delete('to-delete.jpg');
    await expect(bucket.delete('to-delete.jpg')).resolves.toBeUndefined();
    await expect(bucket.delete('never-existed.jpg')).resolves.toBeUndefined();
  });

  itLive('head отсутствующего → ObjectNotFoundError', async () => {
    const bucket = adapter.getBucket(SPEC);
    await expect(bucket.head('does-not-exist.jpg')).rejects.toBeInstanceOf(
      InterFileStorageObjectNotFoundError,
    );
  });

  itLive('превышение maxBytes → ObjectTooLargeError, объект не появился', async () => {
    const bucket = adapter.getBucket(SPEC);
    const tooBig = Buffer.alloc(SPEC.maxBytes + 1);
    await expect(
      bucket.put('too-big.jpg', tooBig, { contentType: 'image/jpeg', metadata: { ownerId: 'u' } }),
    ).rejects.toBeInstanceOf(InterFileStorageObjectTooLargeError);
    await expect(bucket.head('too-big.jpg')).rejects.toBeInstanceOf(
      InterFileStorageObjectNotFoundError,
    );
  });

  itLive('запрещённый MIME → MimeRejectedError, объект не появился', async () => {
    const bucket = adapter.getBucket(SPEC);
    await expect(
      bucket.put('bad.exe', Buffer.from([0]), {
        contentType: 'application/octet-stream',
        metadata: { ownerId: 'u' },
      }),
    ).rejects.toBeInstanceOf(InterFileStorageMimeRejectedError);
    await expect(bucket.head('bad.exe')).rejects.toBeInstanceOf(
      InterFileStorageObjectNotFoundError,
    );
  });

  itLive('отсутствие required-метаданного → MetadataValidationError', async () => {
    const bucket = adapter.getBucket(SPEC);
    await expect(
      bucket.put('no-meta.jpg', Buffer.from([0]), { contentType: 'image/jpeg', metadata: {} }),
    ).rejects.toBeInstanceOf(InterFileStorageMetadataValidationError);
  });

  itLive('HMAC-роут: 200 → 403 (exp) → 403 (sig) → 404', async () => {
    const bucket = adapter.getBucket(SPEC);
    const payload = Buffer.from('end-to-end');
    await bucket.put('hmac-test/x.jpg', payload, {
      contentType: 'image/jpeg',
      metadata: { ownerId: 'u' },
    });

    // 200
    const okUrl = await bucket.getReadUrl('hmac-test/x.jpg', { ttlSeconds: 30 });
    const okParsed = new URL(okUrl);
    const ok = await request(app.getHttpServer())
      .get(okParsed.pathname)
      .query({ exp: okParsed.searchParams.get('exp')!, sig: okParsed.searchParams.get('sig')! });
    expect(ok.status).toBe(200);

    // 403 — истёкший exp
    const pastExp = Math.floor(Date.now() / 1000) - 1;
    const pastSig = signReadUrl({
      bucket: 'orders-images',
      key: 'hmac-test/x.jpg',
      expUnix: pastExp,
      secret: SIGNING_SECRET,
    });
    const expired = await request(app.getHttpServer())
      .get('/api/storage/orders-images/hmac-test/x.jpg')
      .query({ exp: pastExp, sig: pastSig });
    expect(expired.status).toBe(403);

    // 403 — чужой sig
    const futureExp = Math.floor(Date.now() / 1000) + 60;
    const wrongSig = await request(app.getHttpServer())
      .get('/api/storage/orders-images/hmac-test/x.jpg')
      .query({ exp: futureExp, sig: 'a'.repeat(64) });
    expect(wrongSig.status).toBe(403);

    // 404 — несуществующий ключ, но валидная подпись
    const missingKey = 'hmac-test/missing.jpg';
    const missingSig = signReadUrl({
      bucket: 'orders-images',
      key: missingKey,
      expUnix: futureExp,
      secret: SIGNING_SECRET,
    });
    const notFound = await request(app.getHttpServer())
      .get(`/api/storage/orders-images/${missingKey}`)
      .query({ exp: futureExp, sig: missingSig });
    expect(notFound.status).toBe(404);
  }, 30_000);
});

// ─── helpers ─────────────────────────────────────────────────────────────────

function jpegFixture(): Uint8Array {
  // Минимальный валидный JPEG header + EOI; для проверки трактовать как опаковые байты.
  return new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0xff, 0xd9]);
}

function bufferToWebStream(buf: Buffer): ReadableStream<Uint8Array> {
  // Простая реализация без зависимости от node:stream/web.
  let sent = false;
  return {
    getReader() {
      return {
        async read() {
          if (sent) return { value: undefined, done: true };
          sent = true;
          return { value: new Uint8Array(buf), done: false };
        },
        async cancel() {
          /* noop */
        },
      };
    },
  } as unknown as ReadableStream<Uint8Array>;
}

// suppress unused-import warning for Readable in case parser flags
void Readable;
