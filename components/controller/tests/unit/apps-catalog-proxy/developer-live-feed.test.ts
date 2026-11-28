/**
 * Живое обновление столов каталога через ленту ядра (487-37): таблицы ленты,
 * сигнал после мутации узла и сигнал по опросу каталога, который узлу событий
 * не присылает.
 */
jest.mock('@coopenomics/extension-kit', () => ({
  ...jest.requireActual('@coopenomics/extension-kit'),
  platformSettings: () => ({ coopname: 'voskhod' }),
}));

import {
  DEVELOPER_LIVE_CODE,
  DEVELOPER_LIVE_TABLES,
  DeveloperLiveFeedService,
} from '~/extensions/apps-catalog-proxy/application/services/developer-live-feed.service';

type Row = { packageId: string; rubPerMonth: number | null; trialDays: number; lastActiveVersion: string | null; inCatalog: boolean };

function build(opts: { registered?: string[]; operator?: boolean } = {}) {
  const feed = { declareLocalTables: jest.fn(), publishLocal: jest.fn(async () => undefined) };
  let pricing: Row[] = [];
  let moderation: Array<{ id: string; status: string }> = [];
  const catalog = {
    hasOperatorAccess: opts.operator ?? false,
    listDeveloperPricing: jest.fn(async () => pricing),
    listSubmittedModerations: jest.fn(async () => moderation),
  };
  const store = {
    find: jest.fn(async () => (opts.registered ?? ['@voskhod/app']).map((packageId) => ({ packageId, username: 'dev1' }))),
  };
  const service = new DeveloperLiveFeedService(store as never, catalog as never, feed as never);
  return {
    service,
    feed,
    catalog,
    setPricing: (rows: Row[]) => (pricing = rows),
    setModeration: (rows: Array<{ id: string; status: string }>) => (moderation = rows),
  };
}

const row = (over: Partial<Row> = {}): Row => ({
  packageId: '@voskhod/app',
  rubPerMonth: 100,
  trialDays: 0,
  lastActiveVersion: null,
  inCatalog: false,
  ...over,
});

const signals = (feed: { publishLocal: jest.Mock }) => feed.publishLocal.mock.calls.map((c) => [c[0], c[1]]);

describe('живое обновление столов каталога (487-37)', () => {
  it('happy: при запуске объявляет таблицы ленты — назначения и ключи личные, модерация только персоналу', () => {
    const { service, feed } = build();
    service.onModuleInit();
    expect(feed.declareLocalTables).toHaveBeenCalledWith([
      { code: DEVELOPER_LIVE_CODE, table: 'apps_publishers', owner_field: 'username' },
      { code: DEVELOPER_LIVE_CODE, table: 'apps_rights_consents' },
      { code: DEVELOPER_LIVE_CODE, table: 'apps_catalog_packages' },
      { code: DEVELOPER_LIVE_CODE, table: 'apps_publisher_keys', owner_field: 'username' },
      { code: DEVELOPER_LIVE_CODE, table: 'apps_catalog_moderation', staff_only: true },
    ]);
  });

  it('happy: выпуск из терминала и решение модератора — сигнал по пакету на следующем опросе', async () => {
    const t = build();
    t.setPricing([row()]);
    await t.service.pollCatalog();
    expect(t.feed.publishLocal).not.toHaveBeenCalled();
    t.setPricing([row({ inCatalog: true })]);
    await t.service.pollCatalog();
    t.setPricing([row({ inCatalog: true, lastActiveVersion: '0.1.0' })]);
    await t.service.pollCatalog();
    expect(signals(t.feed)).toEqual([
      [DEVELOPER_LIVE_TABLES.packages, '@voskhod/app'],
      [DEVELOPER_LIVE_TABLES.packages, '@voskhod/app'],
    ]);
  });

  it('side: каталог без перемен — сигналов нет; узел без издателей каталог не опрашивает', async () => {
    const t = build();
    t.setPricing([row()]);
    await t.service.pollCatalog();
    await t.service.pollCatalog();
    expect(t.feed.publishLocal).not.toHaveBeenCalled();
    const empty = build({ registered: [] });
    await empty.service.pollCatalog();
    expect(empty.catalog.listDeveloperPricing).not.toHaveBeenCalled();
  });

  it('side: узел оператора — новая заявка в очереди модерации даёт сигнал; узел кооператива очередь не читает', async () => {
    const op = build({ operator: true });
    op.setModeration([{ id: 'm1', status: 'SUBMITTED' }]);
    await op.service.pollCatalog();
    op.setModeration([{ id: 'm1', status: 'SUBMITTED' }, { id: 'm2', status: 'SUBMITTED' }]);
    await op.service.pollCatalog();
    expect(signals(op.feed)).toEqual([[DEVELOPER_LIVE_TABLES.moderation, 'queue']]);
    const coop = build({ operator: false });
    await coop.service.pollCatalog();
    expect(coop.catalog.listSubmittedModerations).not.toHaveBeenCalled();
  });

  it('break: каталог не ответил — опрос молча пропускается, следующий проход работает', async () => {
    const t = build();
    t.catalog.listDeveloperPricing.mockRejectedValueOnce(new Error('catalog down'));
    await expect(t.service.pollCatalog()).resolves.toBeUndefined();
    t.setPricing([row()]);
    await t.service.pollCatalog();
    t.setPricing([row({ rubPerMonth: 200 })]);
    await t.service.pollCatalog();
    expect(signals(t.feed)).toEqual([[DEVELOPER_LIVE_TABLES.packages, '@voskhod/app']]);
  });

  it('happy: ключи API — личный сигнал издателю; без ленты в контуре сервис молчит', async () => {
    const t = build();
    await t.service.keysChanged('dev1');
    expect(t.feed.publishLocal).toHaveBeenCalledWith(DEVELOPER_LIVE_TABLES.keys, 'dev1', { username: 'dev1' });
    const silent = new DeveloperLiveFeedService({ find: jest.fn() } as never, {} as never, null);
    await expect(silent.keysChanged('dev1')).resolves.toBeUndefined();
    await expect(silent.pollCatalog()).resolves.toBeUndefined();
  });
});
