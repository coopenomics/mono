/**
 * @fileoverview Юнит-тесты CatalogDeliveryReleaseMetadata (Story 10.5b): получение
 * install-spec из npm-манифеста catalog-delivery registry. Сеть подменена mock'ом
 * global.fetch. Вход в каталог — tenant JWT от ядра (487-34).
 */
import { CatalogDeliveryReleaseMetadata, splitPackageId } from './catalog-delivery-release-metadata.impl';
import { CatalogTenantToken } from './catalog-tenant-token';

const PACKUMENT = {
  'dist-tags': { latest: '1.2.0' },
  versions: {
    '1.2.0': {
      coopenomics: {
        backend: {
          image: 'registry.coopenomics.world/voskhod/chatcoop:1.2.0',
          subgraphPort: 3001,
          healthcheck: '/_health',
        },
        frontend: {
          tarball: '@voskhod/chatcoop@1.2.0',
          installSha256: 'c'.repeat(64),
        },
      },
    },
    '0.9.0': {},
  },
};

describe('splitPackageId', () => {
  it('распиливает @scope/name и отбрасывает мусор', () => {
    expect(splitPackageId('@voskhod/chatcoop')).toEqual({ scope: 'voskhod', name: 'chatcoop' });
    expect(splitPackageId('chatcoop')).toBeNull();
    expect(splitPackageId('@Bad/Name')).toBeNull();
  });
});

describe('CatalogDeliveryReleaseMetadata', () => {
  const calls: Array<{ url: string; method: string; headers: Record<string, string> }> = [];

  const buildFetch =
    (packument: unknown) =>
    async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
      const u = String(url);
      calls.push({
        url: u,
        method: init?.method ?? 'GET',
        headers: (init?.headers ?? {}) as Record<string, string>,
      });
      if (u.includes('/token')) {
        return new Response(JSON.stringify({ token: 'per-package-jwt' }), { status: 200 });
      }
      return new Response(JSON.stringify(packument), { status: 200 });
    };

  const tenantToken = (value: string | null = 'tenant-jwt') => {
    const token = new CatalogTenantToken();
    if (value !== null) token.set(value);
    return token;
  };
  const build = (token = tenantToken()) =>
    new CatalogDeliveryReleaseMetadata(
      {
        catalogDeliveryBaseUrl: 'http://catalog-delivery:3001',
        coopname: 'voskhod',
        jwtSecret: 'stand-secret',
      },
      token,
    );

  beforeEach(() => {
    calls.length = 0;
    global.fetch = buildFetch(PACKUMENT) as typeof fetch;
  });

  it('строит spec из coopenomics.backend: container/url/health/pullJwt/env', async () => {
    const spec = await build().fetchInstallSpec({
      packageId: '@voskhod/chatcoop',
      version: '1.2.0',
    });
    expect(spec).toEqual({
      url: 'http://ext-chatcoop:3001/v1/graphql',
      healthUrl: 'http://ext-chatcoop:3001/_health',
      imageRef: 'registry.coopenomics.world/voskhod/chatcoop:1.2.0',
      containerName: 'ext-chatcoop',
      pullJwt: 'per-package-jwt',
      containerEnv: {
        SUBGRAPH_PORT: '3001',
        JWT_SECRET: 'stand-secret',
        COOPNAME: 'voskhod',
      },
    });

    // токен пакета выдаётся по tenant JWT кооператива, подписи запроса нет
    const tokenCall = calls.find((c) => c.url.includes('/token'));
    expect(tokenCall?.method).toBe('POST');
    expect(tokenCall?.headers['Authorization']).toBe('Bearer tenant-jwt');
    expect(tokenCall?.headers['X-Signature']).toBeUndefined();
    // registry-запрос с Bearer per-package JWT
    const regCall = calls.find((c) => c.url.includes('/registry/'));
    expect(regCall?.headers['Authorization']).toBe('Bearer per-package-jwt');
  });

  it('break: tenant JWT от ядра ещё не получен — в каталог не ходим', async () => {
    await expect(
      build(tenantToken(null)).fetchInstallSpec({ packageId: '@voskhod/chatcoop', version: '' }),
    ).rejects.toThrow(/tenant JWT/);
    expect(calls).toEqual([]);
  });

  it('latestVersion → dist-tags.latest пакета для кооператива', async () => {
    expect(await build().latestVersion('@voskhod/chatcoop')).toBe('1.2.0');
    global.fetch = buildFetch({ versions: {} }) as typeof fetch;
    expect(await build().latestVersion('@voskhod/chatcoop')).toBeNull();
  });

  it("version='' → dist-tags.latest", async () => {
    const spec = await build().fetchInstallSpec({ packageId: '@voskhod/chatcoop', version: '' });
    expect(spec?.imageRef).toContain(':1.2.0');
  });

  it('версия без coopenomics.backend → null (frontend-only)', async () => {
    const spec = await build().fetchInstallSpec({
      packageId: '@voskhod/chatcoop',
      version: '0.9.0',
    });
    expect(spec).toBeNull();
  });

  it('packageId без scope-формы → null без сетевых вызовов', async () => {
    const spec = await build().fetchInstallSpec({ packageId: 'demoapp', version: '1.0.0' });
    expect(spec).toBeNull();
    expect(calls).toEqual([]);
  });

  describe('fetchInstallSha256 (E12-2, FrontendManifestVerifierPort)', () => {
    it('возвращает coopenomics.frontend.installSha256 версии', async () => {
      const sha = await build().fetchInstallSha256('@voskhod/chatcoop', '1.2.0');
      expect(sha).toBe('c'.repeat(64));
    });

    it('версия без декларации / неизвестная версия / мусорный id → null', async () => {
      const metadata = build();
      expect(await metadata.fetchInstallSha256('@voskhod/chatcoop', '0.9.0')).toBeNull();
      expect(await metadata.fetchInstallSha256('@voskhod/chatcoop', '9.9.9')).toBeNull();
      expect(await metadata.fetchInstallSha256('demoapp', '1.0.0')).toBeNull();
    });

    it('транспортная ошибка → throw (fail-closed на стороне кэша)', async () => {
      global.fetch = (async () => new Response('down', { status: 503 })) as typeof fetch;
      await expect(
        build().fetchInstallSha256('@voskhod/chatcoop', '1.2.0'),
      ).rejects.toThrow(/503/);
    });
  });
});
