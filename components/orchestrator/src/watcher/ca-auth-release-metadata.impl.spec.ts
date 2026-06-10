/**
 * @fileoverview Юнит-тесты CaAuthReleaseMetadata (Story 10.5b): получение
 * install-spec из npm-манифеста CA-auth registry. Сеть подменена mock'ом
 * global.fetch; подпись signed-request проверяется на форму заголовков.
 */
import { CaAuthReleaseMetadata, splitPackageId } from './ca-auth-release-metadata.impl';
import { wifToPrivateKey } from './signed-request.client';

// Известный dev-WIF voskhod (boot config.ini) — валиден как тестовая фикстура.
const TEST_WIF = '5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3';

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

describe('wifToPrivateKey', () => {
  it('декодирует WIF в 32 байта', () => {
    expect(wifToPrivateKey(TEST_WIF).length).toBe(32);
  });
  it('бросает на битой контрольной сумме', () => {
    expect(() => wifToPrivateKey(TEST_WIF.slice(0, -1) + 'X')).toThrow();
  });
});

describe('CaAuthReleaseMetadata', () => {
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

  const build = () =>
    new CaAuthReleaseMetadata({
      caAuthBaseUrl: 'http://ca-auth:3001',
      coopname: 'voskhod',
      cooperativeWif: TEST_WIF,
      jwtSecret: 'stand-secret',
    });

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

    // token-запрос подписан по канону signed-request
    const tokenCall = calls.find((c) => c.url.includes('/token'));
    expect(tokenCall?.method).toBe('POST');
    expect(tokenCall?.headers['X-Signature']).toMatch(/^k1:/);
    expect(tokenCall?.headers['X-Coopname']).toBe('voskhod');
    expect(tokenCall?.headers['X-Nonce']).toMatch(/^[0-9a-f-]{36}$/);
    // registry-запрос с Bearer per-package JWT
    const regCall = calls.find((c) => c.url.includes('/registry/'));
    expect(regCall?.headers['Authorization']).toBe('Bearer per-package-jwt');
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
});
