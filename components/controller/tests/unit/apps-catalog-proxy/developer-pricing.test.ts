/**
 * Цена приложения со стола разработчика (487-31): издатель назначает цену
 * своему пакету, ядро передаёт её каталогу токеном кооператива. Пайщик сам
 * регистрирует новый пакет на себя; цену меняет только издатель пакета,
 * администратор каталога её только видит (27.11.2026). Отказ каталога
 * доходит до резолвера кодом каталога, а пайщику — ошибкой узла с понятным
 * текстом. Модератор видит цену в заявке; без цены каталог одобрение
 * отклоняет, и модератор получает причину словами.
 */
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { configurePlatformSettings } from '@coopenomics/extension-kit';
import { AppsCatalogHttpService } from '~/extensions/apps-catalog-proxy/infrastructure/apps-catalog-http.service';
import { AppsCatalogProxyResolver } from '~/extensions/apps-catalog-proxy/application/resolvers/apps-catalog-proxy.resolver';
import { AppsPublishersService } from '~/extensions/apps-catalog-proxy/application/services/apps-publishers.service';

configurePlatformSettings({ coopname: 'voskhod', blockchain: {} } as any);

const WIF = '5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3';
const JWT = `h.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 1800 })).toString('base64url')}.s`;
const CHAIRMAN = { username: 'ant', role: 'chairman' } as any;
const MEMBER = { username: 'dev1', role: 'user' } as any;

interface Assignment {
  id: number;
  coopname: string;
  username: string;
  packageId: string;
  addedBy: string;
  createdAt: Date;
}

/** Хранилище назначений издателей в памяти: отбор по равенству полей. */
function memoryStore(seed: Array<Pick<Assignment, 'username' | 'packageId'>> = []) {
  const rows: Assignment[] = [];
  const matches = (row: Assignment, where: Partial<Assignment>) =>
    Object.entries(where).every(([k, v]) => row[k as keyof Assignment] === v);
  const store = {
    rows,
    find: async (where: Partial<Assignment>) => rows.filter((r) => matches(r, where)),
    findOne: async (where: Partial<Assignment>) => rows.find((r) => matches(r, where)) ?? null,
    insert: async (row: Omit<Assignment, 'id' | 'createdAt'>) => {
      const saved = { ...row, id: rows.length + 1, createdAt: new Date() };
      rows.push(saved);
      return saved;
    },
    delete: async (where: Partial<Assignment>) => {
      const kept = rows.filter((r) => !matches(r, where));
      rows.splice(0, rows.length, ...kept);
    },
  };
  seed.forEach((s) => rows.push({ ...s, id: rows.length + 1, coopname: 'voskhod', addedBy: s.username, createdAt: new Date() }));
  return store;
}

interface Seen {
  method: string;
  url: string;
  auth: string;
  body: any;
}

/**
 * Подставной каталог: вход кооператива, цены издателя (catalog-delivery) и
 * модерация (catalog-operator) на одном адресе. `refuse` — отказ на запись цены.
 */
function fakeCatalog(opts: { refuse?: { status: number; code: string }; approveCode?: string } = {}) {
  const seen: Seen[] = [];
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      const url = String(req.url);
      res.setHeader('content-type', 'application/json');
      if (url === '/v1/auth/challenge') return res.end(JSON.stringify({ challenge_string: 'ch' }));
      if (url === '/v1/auth/verify') return res.end(JSON.stringify({ token: JWT }));
      seen.push({
        method: String(req.method),
        url,
        auth: String(req.headers.authorization ?? ''),
        body: raw ? JSON.parse(raw) : null,
      });
      if (req.method === 'GET' && url === '/v1/developer/pricing') {
        return res.end(
          JSON.stringify({
            items: [
              { package_id: '@voskhod/paid', monthly_rub: 500, trial_days: 7, last_active_version: '1.0.0', updated_at: '2026-11-26T10:00:00.000Z' },
              { package_id: '@voskhod/fresh', monthly_rub: null, trial_days: 0, last_active_version: null, updated_at: null },
            ],
          }),
        );
      }
      if (req.method === 'PUT' && url.startsWith('/v1/developer/pricing/')) {
        if (opts.refuse) {
          res.statusCode = opts.refuse.status;
          return res.end(JSON.stringify({ error: { code: opts.refuse.code, message: 'catalog says no' } }));
        }
        const body = JSON.parse(raw);
        return res.end(
          JSON.stringify({ package_id: '@voskhod/fresh', monthly_rub: body.monthly_rub, trial_days: body.trial_days, last_active_version: null, updated_at: '2026-11-26T11:00:00.000Z' }),
        );
      }
      if (req.method === 'GET' && url.startsWith('/v1/admin/moderation')) {
        return res.end(
          JSON.stringify({
            items: [
              { id: 'm1', package_id: '@voskhod/paid', version: '1.0.1', scope: { type: 'all' }, brief: 'b', release_type: 'full', status: 'SUBMITTED', submitted_by: 'ant', submitted_at: 't', updated_at: 't', requires_override: false, monthly_rub: 500, trial_days: 7 },
              { id: 'm2', package_id: '@voskhod/fresh', version: '0.1.0', scope: { type: 'all' }, brief: 'b', release_type: 'full', status: 'SUBMITTED', submitted_by: 'ant', submitted_at: 't', updated_at: 't', requires_override: false, monthly_rub: null, trial_days: 0 },
              // Каталог прежней версии цену в заявке не отдаёт.
              { id: 'm3', package_id: '@voskhod/old', version: '0.1.0', scope: { type: 'all' }, brief: 'b', release_type: 'full', status: 'SUBMITTED', submitted_by: 'ant', submitted_at: 't', updated_at: 't', requires_override: false },
            ],
          }),
        );
      }
      if (req.method === 'POST' && /\/v1\/admin\/moderation\/.+\/approve$/.test(url)) {
        res.statusCode = 409;
        return res.end(JSON.stringify({ error: { code: opts.approveCode ?? 'RELEASE_CONFLICT', message: 'raw catalog text' } }));
      }
      res.statusCode = 404;
      res.end('{}');
    });
  });
  return { server, seen };
}

async function build(
  cat: ReturnType<typeof fakeCatalog>,
  seed: Array<Pick<Assignment, 'username' | 'packageId'>> = [{ username: 'ant', packageId: '@voskhod/fresh' }],
) {
  await new Promise<void>((r) => cat.server.listen(0, '127.0.0.1', r));
  const { port } = cat.server.address() as AddressInfo;
  const base = `http://127.0.0.1:${port}`;
  const env: Record<string, string> = {
    APPS_CATALOG_DELIVERY_URL: base,
    APPS_CATALOG_OPERATOR_URL: base,
    APPS_CATALOG_OPERATOR_API_KEY: 'operator-key',
  };
  const config = { get: (k: string) => env[k] };
  const client = new AppsCatalogHttpService(config as any, { getWif: async () => WIF } as any);
  const store = memoryStore(seed);
  const resolver = new AppsCatalogProxyResolver(client, new AppsPublishersService(store as any, client));
  return { client, resolver, store };
}

describe('цена приложения со стола разработчика (487-31)', () => {
  let close: (() => void) | undefined;
  afterEach(() => close?.());

  it('happy: администратор видит цены всех пакетов кооператива — запрос каталогу токеном кооператива, пакет без цены отдаётся пустой ценой', async () => {
    const cat = fakeCatalog();
    close = () => cat.server.close();
    const { resolver } = await build(cat);
    const out = await resolver.appsPackagePricing(CHAIRMAN);
    expect(out).toEqual([
      { packageId: '@voskhod/paid', rubPerMonth: 500, trialDays: 7, lastActiveVersion: '1.0.0', updatedAt: '2026-11-26T10:00:00.000Z' },
      { packageId: '@voskhod/fresh', rubPerMonth: null, trialDays: 0, lastActiveVersion: null, updatedAt: null },
    ]);
    expect(cat.seen[0]).toMatchObject({ method: 'GET', url: '/v1/developer/pricing', auth: `Bearer ${JWT}` });
  });

  it('happy: издатель назначает 499,99 ₽ и пробный срок — каталог получает рубли в месяц без пересчёта', async () => {
    const cat = fakeCatalog();
    close = () => cat.server.close();
    const { resolver } = await build(cat);
    const out = await resolver.setAppsPackagePricing({ packageId: '@voskhod/fresh', rubPerMonth: 499.99, trialDays: 14 }, CHAIRMAN);
    expect(out).toMatchObject({ packageId: '@voskhod/fresh', rubPerMonth: 499.99, trialDays: 14 });
    expect(cat.seen[0]).toMatchObject({
      method: 'PUT',
      url: '/v1/developer/pricing/voskhod/fresh',
      auth: `Bearer ${JWT}`,
      body: { monthly_rub: 499.99, trial_days: 14 },
    });
  });

  it('side: издатель видит цены только своих пакетов; пайщик без пакетов — пустой список', async () => {
    const cat = fakeCatalog();
    close = () => cat.server.close();
    const { resolver } = await build(cat, [{ username: 'dev1', packageId: '@voskhod/paid' }]);
    const mine = await resolver.appsPackagePricing(MEMBER);
    expect(mine.map((p) => p.packageId)).toEqual(['@voskhod/paid']);
    await expect(resolver.appsPackagePricing({ username: 'dev2', role: 'user' } as any)).resolves.toEqual([]);
  });

  it('break: цену чужого пакета не меняет никто, включая администратора каталога — каталог запрос не получает', async () => {
    const cat = fakeCatalog();
    close = () => cat.server.close();
    const { resolver } = await build(cat, [{ username: 'dev1', packageId: '@voskhod/fresh' }]);
    await expect(
      resolver.setAppsPackagePricing({ packageId: '@voskhod/fresh', rubPerMonth: 1, trialDays: 0 }, CHAIRMAN),
    ).rejects.toThrow(/не назначен издателем/);
    expect(cat.seen.filter((r) => r.method === 'PUT')).toEqual([]);
  });

  it('happy: пайщик регистрирует на себя новый пакет и становится его издателем; повтор отдаёт ту же запись', async () => {
    const cat = fakeCatalog();
    close = () => cat.server.close();
    const { resolver, store } = await build(cat, []);
    const first = await resolver.addAppsPublisher({ username: 'dev1', packageId: '@voskhod/newapp' }, MEMBER);
    expect(first).toMatchObject({ username: 'dev1', packageId: '@voskhod/newapp', addedBy: 'dev1' });
    await resolver.addAppsPublisher({ username: 'dev1', packageId: '@voskhod/newapp' }, MEMBER);
    expect(store.rows).toHaveLength(1);
  });

  it('break: занятый пакет пайщик на себя не регистрирует — пакет другого издателя, пакет из каталога без издателя, пакет чужого кооператива', async () => {
    const cat = fakeCatalog();
    close = () => cat.server.close();
    const { resolver, store } = await build(cat, [{ username: 'ant', packageId: '@voskhod/taken' }]);
    await expect(resolver.addAppsPublisher({ username: 'dev1', packageId: '@voskhod/taken' }, MEMBER)).rejects.toThrow(/другим пайщиком/);
    await expect(resolver.addAppsPublisher({ username: 'dev1', packageId: '@voskhod/paid' }, MEMBER)).rejects.toThrow(/уже есть в каталоге/);
    await expect(resolver.addAppsPublisher({ username: 'dev1', packageId: '@other/app' }, MEMBER)).rejects.toThrow(/пространство/);
    expect(store.rows).toHaveLength(1);
  });

  it('break: пайщик назначает издателем другого пайщика — отказ; администратор назначает издателя и пакету из каталога', async () => {
    const cat = fakeCatalog();
    close = () => cat.server.close();
    const { resolver } = await build(cat, []);
    const err = await resolver.addAppsPublisher({ username: 'dev2', packageId: '@voskhod/newapp' }, MEMBER).catch((e) => e);
    expect(err.code).toBe('APPS_CATALOG_PROXY_PUBLISHER_FOREIGN_ASSIGNMENT');
    const assigned = await resolver.addAppsPublisher({ username: 'dev2', packageId: '@voskhod/paid' }, CHAIRMAN);
    expect(assigned).toMatchObject({ username: 'dev2', packageId: '@voskhod/paid', addedBy: 'ant' });
  });

  it('side: пробный срок не указан — каталог получает 0 дней', async () => {
    const cat = fakeCatalog();
    close = () => cat.server.close();
    const { resolver } = await build(cat);
    await resolver.setAppsPackagePricing({ packageId: '@voskhod/fresh', rubPerMonth: 0 }, CHAIRMAN);
    expect(cat.seen[0].body).toEqual({ monthly_rub: 0, trial_days: 0 });
  });

  it.each([
    [403, 'SCOPE_MISMATCH', 'APPS_CATALOG_PROXY_PRICING_FOREIGN_PACKAGE'],
    [404, 'PACKAGE_NOT_FOUND', 'APPS_CATALOG_PROXY_PRICING_PACKAGE_NOT_REGISTERED'],
    [400, 'INVALID_PRICING', 'APPS_CATALOG_PROXY_PRICING_INVALID'],
    [500, 'INTERNAL_ERROR', 'APPS_CATALOG_PROXY_PRICING_FAILED'],
  ])('break: каталог отказал %i %s — ошибка узла %s, текст каталога пайщику не показывается', async (status, code, expected) => {
    const cat = fakeCatalog({ refuse: { status, code } });
    close = () => cat.server.close();
    const { resolver } = await build(cat);
    const err = await resolver
      .setAppsPackagePricing({ packageId: '@voskhod/fresh', rubPerMonth: 100, trialDays: 0 }, CHAIRMAN)
      .catch((e) => e);
    expect(err.code).toBe(expected);
    expect(String(err.message)).not.toContain('catalog says no');
  });

  it('break: адрес каталога не настроен — список пуст, назначение цены отклоняется ошибкой узла', async () => {
    const client = new AppsCatalogHttpService({ get: () => undefined } as any, { getWif: async () => WIF } as any);
    const store = memoryStore([{ username: 'ant', packageId: '@voskhod/fresh' }]);
    const resolver = new AppsCatalogProxyResolver(client, new AppsPublishersService(store as any, client));
    await expect(resolver.appsPackagePricing(CHAIRMAN)).resolves.toEqual([]);
    const err = await resolver
      .setAppsPackagePricing({ packageId: '@voskhod/fresh', rubPerMonth: 100, trialDays: 0 }, CHAIRMAN)
      .catch((e) => e);
    expect(err.code).toBe('APPS_CATALOG_PROXY_PRICING_FAILED');
  });

  it('happy: заявка на модерацию несёт цену издателя; без цены и от каталога прежней версии — пустая цена', async () => {
    const cat = fakeCatalog();
    close = () => cat.server.close();
    const { resolver } = await build(cat);
    const items = await resolver.appsCatalogPendingModerations('SUBMITTED' as any);
    expect(items.map((m) => [m.id, m.rubPerMonth, m.trialDays])).toEqual([
      ['m1', 500, 7],
      ['m2', null, 0],
      ['m3', null, 0],
    ]);
  });

  it('break: одобрение пакета без цены — каталог отвечает PRICING_NOT_SET, модератор получает причину словами', async () => {
    const cat = fakeCatalog({ approveCode: 'PRICING_NOT_SET' });
    close = () => cat.server.close();
    const { client } = await build(cat);
    const out = await client.approveModeration({ moderationId: 'm2', scope: { type: 'all' } } as any);
    expect(out.status).toBe('conflict');
    expect((out as { error: string }).error).toContain('Цена приложения не назначена');
    expect((out as { error: string }).error).not.toContain('raw catalog text');
  });

  it('side: прочий конфликт одобрения — текст каталога сохраняется для разбора', async () => {
    const cat = fakeCatalog({ approveCode: 'RELEASE_CONFLICT' });
    close = () => cat.server.close();
    const { client } = await build(cat);
    const out = await client.approveModeration({ moderationId: 'm1', scope: { type: 'all' } } as any);
    expect(out.status).toBe('conflict');
    expect((out as { error: string }).error).toContain('RELEASE_CONFLICT');
  });
});
