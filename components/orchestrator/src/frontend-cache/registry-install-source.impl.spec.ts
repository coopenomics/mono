/**
 * Фронт приложения из реестра каталога по подписке кооператива (487-37):
 * узел берёт install.js из архива версии токеном пакета, ключ оператора
 * каталога ему не требуется.
 */
import { gzipSync } from 'node:zlib';
import { CatalogTenantToken } from '../watcher/catalog-tenant-token';
import { RegistryInstallSource, findInTar } from './registry-install-source.impl';

/** Запись tar: заголовок 512 байт и содержимое, добитое нулями до блока. */
function tarEntry(path: string, content: string, type = '0'): Buffer {
  const header = Buffer.alloc(512);
  header.write(path, 0, 100, 'utf8');
  header.write(Buffer.byteLength(content).toString(8).padStart(11, '0'), 124, 12, 'utf8');
  header.write(type, 156, 1, 'utf8');
  const body = Buffer.alloc(Math.ceil(Buffer.byteLength(content) / 512) * 512);
  body.write(content, 0, 'utf8');
  return Buffer.concat([header, body]);
}

const tarOf = (...entries: Buffer[]): Buffer => Buffer.concat([...entries, Buffer.alloc(1024)]);

const PACKUMENT = {
  'dist-tags': { latest: '0.3.0' },
  versions: {
    '0.3.0': {
      dist: { tarball: 'https://catalog.example/registry/@voskhod/exampleapp/-/exampleapp-0.3.0.tgz' },
      coopenomics: { frontend: { installSha256: 'abc123' } },
    },
  },
};

class StubSource extends RegistryInstallSource {
  calls: Array<{ url: string; auth: string }> = [];
  constructor(private readonly answers: Record<string, () => Response>, token: CatalogTenantToken) {
    super({ catalogDeliveryBaseUrl: 'http://catalog-delivery:3001' }, token);
  }
  protected async fetch(url: string, init: RequestInit): Promise<Response> {
    this.calls.push({ url, auth: (init.headers as Record<string, string>).Authorization });
    const path = url.replace('http://catalog-delivery:3001', '');
    const answer = this.answers[path];
    return answer ? answer() : new Response('{}', { status: 404 });
  }
}

function build(answers: Record<string, () => Response>, tenant: string | null = 'tenant-jwt') {
  const token = new CatalogTenantToken();
  if (tenant !== null) token.set(tenant);
  return new StubSource(answers, token);
}

const TOKEN_PATH = '/v1/package/@voskhod/exampleapp/token';
const PACKUMENT_PATH = '/registry/@voskhod/exampleapp';
const TARBALL_PATH = '/registry/@voskhod/exampleapp/-/exampleapp-0.3.0.tgz';
const json = (body: unknown, status = 200) => () => new Response(JSON.stringify(body), { status });
const tarball = (...entries: Buffer[]) => () => new Response(gzipSync(tarOf(...entries)), { status: 200 });

describe('findInTar', () => {
  it('happy: файл найден по пути, содержимое без добивки блока', () => {
    const tar = tarOf(tarEntry('package/package.json', '{}'), tarEntry('package/install.js', 'frame();'));
    expect(findInTar(tar, ['package/install.js'])?.toString()).toBe('frame();');
  });

  it('side: из кандидатов берётся первый по порядку предпочтения, каталог с тем же именем файлом не считается', () => {
    const tar = tarOf(
      tarEntry('package/dist/install.js', 'built();'),
      tarEntry('package/install.js', '', '5'),
    );
    expect(findInTar(tar, ['package/install.js', 'package/dist/install.js'])?.toString()).toBe('built();');
  });

  it('break: файла нет, архив пуст либо обрезан — null', () => {
    expect(findInTar(tarOf(tarEntry('package/readme.md', 'x')), ['package/install.js'])).toBeNull();
    expect(findInTar(Buffer.alloc(0), ['package/install.js'])).toBeNull();
    expect(findInTar(tarEntry('package/install.js', 'frame();').subarray(0, 514), ['package/install.js'])).toBeNull();
  });
});

describe('RegistryInstallSource', () => {
  it('happy: фронт взят из архива версии токеном пакета; вход — токен кооператива, ключа оператора нет', async () => {
    const source = build({
      [TOKEN_PATH]: json({ token: 'package-jwt' }),
      [PACKUMENT_PATH]: json(PACKUMENT),
      [TARBALL_PATH]: tarball(tarEntry('package/install.js', 'frame();')),
    });
    const out = await source.fetchInstallScript('voskhod', 'exampleapp');
    expect(out).toEqual(expect.objectContaining({ status: 'ok', declaredSha256: 'abc123', version: '0.3.0' }));
    expect(out.status === 'ok' && out.content.toString()).toBe('frame();');
    expect(source.calls.map((c) => c.auth)).toEqual(['Bearer tenant-jwt', 'Bearer package-jwt', 'Bearer package-jwt']);
  });

  it('break: подписки нет — каталог не выдал токен пакета, фронта на узле нет', async () => {
    const source = build({ [TOKEN_PATH]: json({ error: { code: 'SUBSCRIPTION_EXPIRED' } }, 403) });
    expect(await source.fetchInstallScript('voskhod', 'exampleapp')).toEqual(expect.objectContaining({ status: 'notFound' }));
    expect(source.calls).toHaveLength(1);
  });

  it('break: у пакета нет действующего выпуска либо в архиве нет фронта — notFound', async () => {
    const noRelease = build({ [TOKEN_PATH]: json({ token: 'package-jwt' }), [PACKUMENT_PATH]: json({ 'dist-tags': {}, versions: {} }) });
    expect(await noRelease.fetchInstallScript('voskhod', 'exampleapp')).toEqual(expect.objectContaining({ status: 'notFound' }));
    const backendOnly = build({
      [TOKEN_PATH]: json({ token: 'package-jwt' }),
      [PACKUMENT_PATH]: json(PACKUMENT),
      [TARBALL_PATH]: tarball(tarEntry('package/package.json', '{}')),
    });
    expect(await backendOnly.fetchInstallScript('voskhod', 'exampleapp')).toEqual(expect.objectContaining({ status: 'notFound' }));
  });

  it('side: ядро ещё не передало токен кооператива — источник недоступен, каталог не вызывается', async () => {
    const source = build({}, null);
    expect(await source.fetchInstallScript('voskhod', 'exampleapp')).toEqual(expect.objectContaining({ status: 'unavailable' }));
    expect(source.calls).toEqual([]);
  });

  it('side: каталог ответил сбоем — источник недоступен, кэш фронта не трогается', async () => {
    const down = build({ [TOKEN_PATH]: json({}, 503) });
    expect(await down.fetchInstallScript('voskhod', 'exampleapp')).toEqual(expect.objectContaining({ status: 'unavailable' }));
    const broken = build({
      [TOKEN_PATH]: json({ token: 'package-jwt' }),
      [PACKUMENT_PATH]: json(PACKUMENT),
      [TARBALL_PATH]: () => new Response('не архив', { status: 200 }),
    });
    expect(await broken.fetchInstallScript('voskhod', 'exampleapp')).toEqual(expect.objectContaining({ status: 'unavailable' }));
  });
});
