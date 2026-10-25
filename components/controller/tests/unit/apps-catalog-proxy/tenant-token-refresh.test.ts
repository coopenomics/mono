/**
 * Токен каталога после смены ключа (487-32: JWT каталога на Ed25519):
 * каталог отвечает 401 на выпущенный раньше токен — ядро сбрасывает кэш,
 * получает новый токен подписью ключа <coop>@catalog и повторяет запрос
 * один раз. Повторный 401 наружу отдаётся как отказ, без бесконечного цикла.
 */
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { configurePlatformSettings } from '@coopenomics/extension-kit';
import { AppsCatalogHttpService } from '~/extensions/apps-catalog-proxy/infrastructure/apps-catalog-http.service';

configurePlatformSettings({ coopname: 'romashka', blockchain: {} } as any);

const WIF = '5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3';
// Время зафиксировано на прогон: токены сравниваются строками, и срок от
// Date.now() в момент сравнения разошёлся бы на смене секунды.
const NOW = Math.floor(Date.now() / 1000);
const jwt = (n: number) =>
  `h.${Buffer.from(JSON.stringify({ exp: NOW + 1800, n })).toString('base64url')}.s`;

/** Подставной catalog-delivery: каждый verify выдаёт новый токен, релизы принимает только `accepted`. */
function fakeCatalog(accepted: () => string | null) {
  let issued = 0;
  const releaseAuth: string[] = [];
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      res.setHeader('content-type', 'application/json');
      if (req.url === '/v1/auth/challenge') return res.end(JSON.stringify({ challenge_string: 'ch' }));
      if (req.url === '/v1/auth/verify') return res.end(JSON.stringify({ token: jwt(++issued) }));
      if (req.url === '/v1/releases') {
        const auth = String(req.headers.authorization ?? '');
        releaseAuth.push(auth);
        if (auth !== `Bearer ${accepted()}`) {
          res.statusCode = 401;
          return res.end(JSON.stringify({ error: { code: 'JWT_INVALID' } }));
        }
        return res.end(JSON.stringify({ ok: true, outcome: 'queued', moderation_id: 'm1' }));
      }
      res.statusCode = 404;
      res.end('{}');
    });
  });
  return { server, releaseAuth, issued: () => issued };
}

async function serviceAt(server: http.Server): Promise<AppsCatalogHttpService> {
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address() as AddressInfo;
  const config = { get: (k: string) => (k === 'APPS_CATALOG_DELIVERY_URL' ? `http://127.0.0.1:${port}` : undefined) };
  return new AppsCatalogHttpService(config as any, { getWif: async () => WIF } as any);
}

describe('токен каталога: 401 → новый токен и один повтор', () => {
  let close: (() => void) | undefined;
  afterEach(() => close?.());

  it('happy: первый токен отвергнут (ключ каталога сменился) — второй выпущен, запрос прошёл', async () => {
    const cat = fakeCatalog(() => jwt(2));
    close = () => cat.server.close();
    const svc = await serviceAt(cat.server);
    const r = await svc.createRelease({ packageId: '@voskhod/demoapp', version: '1.0.0' } as any);
    expect(r.status).toBe('queued');
    expect(cat.issued()).toBe(2);
    expect(cat.releaseAuth).toEqual([`Bearer ${jwt(1)}`, `Bearer ${jwt(2)}`]);
  });

  it('break: каталог отвергает и свежий токен — отказ после одного повтора', async () => {
    const cat = fakeCatalog(() => null);
    close = () => cat.server.close();
    const svc = await serviceAt(cat.server);
    const r = await svc.createRelease({ packageId: '@voskhod/demoapp', version: '1.0.0' } as any);
    expect(r.status).toBe('failed');
    expect(cat.releaseAuth).toHaveLength(2);
  });
});

describe('токен оркестратору: живёт до следующей передачи', () => {
  it('break: кэшированный токен истекает через 5 минут — оркестратор получает свежий', async () => {
    let issued = 0;
    const pushed: string[] = [];
    // Первый токен живёт 5 минут, следующие — полчаса.
    const token = (n: number) =>
      `h.${Buffer.from(JSON.stringify({ exp: NOW + (n === 1 ? 300 : 1800), n })).toString('base64url')}.s`;
    const server = http.createServer((req, res) => {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        res.setHeader('content-type', 'application/json');
        if (req.url === '/v1/auth/challenge') return res.end(JSON.stringify({ challenge_string: 'ch' }));
        if (req.url === '/v1/auth/verify') return res.end(JSON.stringify({ token: token(++issued) }));
        if (req.url === '/v1/internal/catalog/tenant-token') {
          pushed.push(JSON.parse(body).token);
          return res.end('{}');
        }
        if (req.url === '/v1/releases') return res.end(JSON.stringify({ ok: true, outcome: 'queued', moderation_id: 'm1' }));
        res.statusCode = 404;
        res.end('{}');
      });
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const { port } = server.address() as AddressInfo;
    const base = `http://127.0.0.1:${port}`;
    const config = {
      get: (k: string) => (k === 'APPS_CATALOG_DELIVERY_URL' || k === 'ORCHESTRATOR_URL' ? base : undefined),
    };
    const svc = new AppsCatalogHttpService(config as any, { getWif: async () => WIF } as any);
    try {
      // Обычный запрос кэширует первый, короткий токен.
      await svc.createRelease({ packageId: '@voskhod/demoapp', version: '1.0.0' } as any);
      expect(issued).toBe(1);
      await svc.pushCatalogTokenToOrchestrator();
      expect(issued).toBe(2);
      expect(pushed).toEqual([token(2)]);
    } finally {
      server.close();
    }
  });
});
