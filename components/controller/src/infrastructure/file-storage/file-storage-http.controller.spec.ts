import 'reflect-metadata';
import { Readable } from 'stream';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import {
  InterFileStorageBackendUnavailableError,
  InterFileStorageObjectNotFoundError,
} from '@coopenomics/inter';
import {
  FILE_STORAGE_OPTIONS,
  type FileStorageInfrastructureOptions,
} from './file-storage.config';
import { FileStorageHttpController } from './file-storage-http.controller';
import { MinioFileStorageAdapter } from './minio-file-storage.adapter';
import { signReadUrl } from './signing';

const OPTS: FileStorageInfrastructureOptions = {
  endpoint: 'http://minio:9000',
  accessKey: 'AKIA-test',
  secretKey: 'sk-test',
  bucket: 'coop-test',
  signingSecret: 'signing-secret-32-bytes-aaaaaaaa',
  publicBaseUrl: 'https://test.example.org',
};

interface AdapterStub {
  fetchObjectForReadProxy: jest.Mock;
}

async function makeApp(stub: AdapterStub): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    controllers: [FileStorageHttpController],
    providers: [
      { provide: FILE_STORAGE_OPTIONS, useValue: OPTS },
      { provide: MinioFileStorageAdapter, useValue: stub },
    ],
  }).compile();
  const app = moduleRef.createNestApplication();
  await app.init();
  return app;
}

function makeStream(bytes: Buffer): Readable {
  return Readable.from([bytes]);
}

function makeStub(): AdapterStub {
  return { fetchObjectForReadProxy: jest.fn() };
}

function urlFor(bucket: string, key: string, ttlSeconds: number): { path: string; exp: number; sig: string } {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const sig = signReadUrl({ bucket, key, expUnix: exp, secret: OPTS.signingSecret });
  const encodedKey = key.split('/').map(encodeURIComponent).join('/');
  return { path: `/api/storage/${encodeURIComponent(bucket)}/${encodedKey}`, exp, sig };
}

describe('FileStorageHttpController', () => {
  let app: INestApplication;
  let stub: AdapterStub;

  beforeEach(() => {
    stub = makeStub();
  });

  afterEach(async () => {
    if (app) await app.close();
  });

  it('200 + байты при валидной подписи', async () => {
    app = await makeApp(stub);
    const payload = Buffer.from('hello world');
    stub.fetchObjectForReadProxy.mockResolvedValueOnce({
      stream: makeStream(payload),
      size: payload.length,
      contentType: 'image/jpeg',
      lastModified: new Date(),
    });

    const u = urlFor('orders-images', 'orders/42/main.jpg', 60);
    const res = await request(app.getHttpServer())
      .get(u.path)
      .query({ exp: u.exp, sig: u.sig })
      .buffer(true)
      .parse((response, cb) => {
        const chunks: Buffer[] = [];
        response.on('data', (c) => chunks.push(c));
        response.on('end', () => cb(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('image/jpeg');
    expect(res.headers['content-length']).toBe(String(payload.length));
    expect(res.headers['cache-control']).toMatch(/^private, max-age=\d+$/);
    expect((res.body as Buffer).equals(payload)).toBe(true);

    expect(stub.fetchObjectForReadProxy).toHaveBeenCalledWith('orders-images/orders/42/main.jpg');
  });

  it('403 при неверной подписи', async () => {
    app = await makeApp(stub);
    const u = urlFor('orders-images', 'a.jpg', 60);
    const res = await request(app.getHttpServer())
      .get(u.path)
      .query({ exp: u.exp, sig: 'a'.repeat(64) });
    expect(res.status).toBe(403);
    expect(stub.fetchObjectForReadProxy).not.toHaveBeenCalled();
  });

  it('403 при истёкшем exp', async () => {
    app = await makeApp(stub);
    const exp = Math.floor(Date.now() / 1000) - 1;
    const sig = signReadUrl({ bucket: 'orders-images', key: 'a.jpg', expUnix: exp, secret: OPTS.signingSecret });
    const res = await request(app.getHttpServer())
      .get('/api/storage/orders-images/a.jpg')
      .query({ exp, sig });
    expect(res.status).toBe(403);
    expect(stub.fetchObjectForReadProxy).not.toHaveBeenCalled();
  });

  it('403 при отсутствии exp/sig', async () => {
    app = await makeApp(stub);
    const res = await request(app.getHttpServer()).get('/api/storage/orders-images/a.jpg');
    expect(res.status).toBe(403);
  });

  it('403 при подмене bucket в URL (HMAC связан с bucket)', async () => {
    app = await makeApp(stub);
    const exp = Math.floor(Date.now() / 1000) + 60;
    const sig = signReadUrl({
      bucket: 'orders-images',
      key: 'a.jpg',
      expUnix: exp,
      secret: OPTS.signingSecret,
    });
    const res = await request(app.getHttpServer())
      .get('/api/storage/expenses-receipts/a.jpg')
      .query({ exp, sig });
    expect(res.status).toBe(403);
  });

  it('403 при подмене key в URL (HMAC связан с key)', async () => {
    app = await makeApp(stub);
    const exp = Math.floor(Date.now() / 1000) + 60;
    const sig = signReadUrl({
      bucket: 'orders-images',
      key: 'a.jpg',
      expUnix: exp,
      secret: OPTS.signingSecret,
    });
    const res = await request(app.getHttpServer())
      .get('/api/storage/orders-images/b.jpg')
      .query({ exp, sig });
    expect(res.status).toBe(403);
  });

  it('404 при ObjectNotFoundError от адаптера', async () => {
    app = await makeApp(stub);
    stub.fetchObjectForReadProxy.mockRejectedValueOnce(
      new InterFileStorageObjectNotFoundError('missing'),
    );
    const u = urlFor('orders-images', 'missing.jpg', 60);
    const res = await request(app.getHttpServer()).get(u.path).query({ exp: u.exp, sig: u.sig });
    expect(res.status).toBe(404);
  });

  it('502 при BackendUnavailableError от адаптера', async () => {
    app = await makeApp(stub);
    stub.fetchObjectForReadProxy.mockRejectedValueOnce(
      new InterFileStorageBackendUnavailableError('backend down'),
    );
    const u = urlFor('orders-images', 'x.jpg', 60);
    const res = await request(app.getHttpServer()).get(u.path).query({ exp: u.exp, sig: u.sig });
    expect(res.status).toBe(502);
  });

  it('правильно парсит составной ключ с / и спецсимволами', async () => {
    app = await makeApp(stub);
    const payload = Buffer.from('xy');
    stub.fetchObjectForReadProxy.mockResolvedValueOnce({
      stream: makeStream(payload),
      size: payload.length,
      contentType: 'application/pdf',
      lastModified: new Date(),
    });

    const key = 'reports/q1 2026/r 1.pdf';
    const u = urlFor('expenses-receipts', key, 60);
    const res = await request(app.getHttpServer())
      .get(u.path)
      .query({ exp: u.exp, sig: u.sig });

    expect(res.status).toBe(200);
    expect(stub.fetchObjectForReadProxy).toHaveBeenCalledWith(`expenses-receipts/${key}`);
  });
});
