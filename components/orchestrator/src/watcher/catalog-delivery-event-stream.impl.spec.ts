/**
 * @fileoverview Поток событий каталога (487-34): watcher узнаёт о подписках и
 * выпусках опросом catalog-delivery вместо таблиц контракта apps.
 */
import { CatalogDeliveryEventStream, type LatestVersionPort } from './catalog-delivery-event-stream.impl';
import { CatalogTenantToken } from './catalog-tenant-token';
import type { AppsContractEvent } from './ports';

const PKG = '@voskhod/chatcoop';

describe('CatalogDeliveryEventStream', () => {
  let active: Array<{ package_id: string; state: string; end_at: string }>;
  let authHeaders: string[];
  let latest: string | null;

  beforeEach(() => {
    active = [{ package_id: PKG, state: 'active', end_at: '2026-11-30T00:00:00.000Z' }];
    authHeaders = [];
    latest = '1.0.0';
    global.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
      authHeaders.push((init?.headers as Record<string, string>).Authorization);
      return new Response(JSON.stringify({ subscriptions: active, meta: {} }), { status: 200 });
    }) as typeof fetch;
  });

  const build = (releasePollEvery = 1) => {
    const token = new CatalogTenantToken();
    token.set('tenant-jwt');
    const versions: LatestVersionPort = { latestVersion: jest.fn(async () => latest) };
    const stream = new CatalogDeliveryEventStream(
      { catalogDeliveryBaseUrl: 'http://catalog-delivery:3001', coopname: 'voskhod', pollIntervalMs: 1000, releasePollEvery },
      token,
      versions,
    );
    const events: AppsContractEvent[] = [];
    const handler = jest.fn(async (e: AppsContractEvent) => {
      events.push(e);
    });
    return { stream, events, handler, versions };
  };

  it('happy: первый опрос — снимок: каждая действующая подписка даёт активацию; вход по tenant JWT', async () => {
    const { stream, events, handler } = build();
    await stream.poll(handler);
    expect(events).toEqual([
      expect.objectContaining({ kind: 'subscription-activated', coopname: 'voskhod', packageId: PKG }),
    ]);
    expect(authHeaders).toEqual(['Bearer tenant-jwt']);
  });

  it('break: продление подписки (новый end_at) не переустанавливает пакет', async () => {
    const { stream, events, handler } = build();
    await stream.poll(handler);
    active[0].end_at = '2026-12-31T00:00:00.000Z';
    await stream.poll(handler);
    expect(events.filter((e) => e.kind === 'subscription-activated')).toHaveLength(1);
  });

  it('happy: подписка пропала или истекла — subscription-expired', async () => {
    const { stream, events, handler } = build();
    await stream.poll(handler);
    active[0].state = 'expired';
    await stream.poll(handler);
    expect(events[events.length - 1]).toEqual(
      expect.objectContaining({ kind: 'subscription-expired', packageId: PKG }),
    );
  });

  it('side: установка при активации упала — следующий опрос выдаёт активацию снова', async () => {
    const { stream, events } = build();
    const failing = jest.fn(async (e: AppsContractEvent) => {
      events.push(e);
      throw new Error('docker pull failed');
    });
    await stream.poll(failing);
    await stream.poll(failing);
    expect(events.filter((e) => e.kind === 'subscription-activated')).toHaveLength(2);
  });

  it('happy: новая версия у действующей подписки — release-published; первое наблюдение версии события не даёт', async () => {
    const { stream, events, handler } = build();
    await stream.poll(handler); // снимок
    await stream.poll(handler); // первое наблюдение 1.0.0
    latest = '1.1.0';
    await stream.poll(handler);
    const published = events.filter((e) => e.kind === 'release-published');
    expect(published).toEqual([expect.objectContaining({ packageId: PKG, version: '1.1.0', scopeType: 'all' })]);
  });

  it('happy: у пакета не осталось доступной версии — release-withdrawn', async () => {
    const { stream, events, handler } = build();
    await stream.poll(handler);
    await stream.poll(handler);
    latest = null;
    await stream.poll(handler);
    expect(events[events.length - 1]).toEqual(
      expect.objectContaining({ kind: 'release-withdrawn', packageId: PKG, version: '1.0.0' }),
    );
  });

  it('side: версии проверяются раз в releasePollEvery опросов', async () => {
    const { stream, handler, versions } = build(3);
    for (let i = 0; i < 4; i += 1) await stream.poll(handler);
    expect(versions.latestVersion).toHaveBeenCalledTimes(1);
  });

  it('break: каталог ответил ошибкой — событий нет, известные подписки не теряются', async () => {
    const { stream, events, handler } = build();
    await stream.poll(handler);
    global.fetch = (async () => new Response('down', { status: 503 })) as typeof fetch;
    await expect(stream.poll(handler)).rejects.toThrow(/503/);
    expect(events.filter((e) => e.kind === 'subscription-expired')).toHaveLength(0);
  });
});
