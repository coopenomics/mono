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

  const build = (
    releasePollEvery = 1,
    installedPackages?: () => Promise<string[]>,
    runningPackages?: () => Promise<string[]>,
  ) => {
    const token = new CatalogTenantToken();
    token.set('tenant-jwt');
    const versions: LatestVersionPort = { latestVersion: jest.fn(async () => latest) };
    const stream = new CatalogDeliveryEventStream(
      {
        catalogDeliveryBaseUrl: 'http://catalog-delivery:3001',
        coopname: 'voskhod',
        pollIntervalMs: 1000,
        releasePollEvery,
        installedPackages,
        runningPackages,
      },
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

  // Сломанный образ не должен дёргать реестр каждый опрос: первая неудача
  // повторяется следующим опросом, дальше пауза удваивается (25.11.2026).
  it('side: установка падает подряд — третья попытка ждёт паузу, после паузы идёт снова', async () => {
    jest.useFakeTimers({ now: new Date('2026-11-25T12:00:00.000Z') });
    try {
      const { stream, events } = build();
      const failing = jest.fn(async (e: AppsContractEvent) => {
        events.push(e);
        throw new Error('docker pull failed');
      });
      const activations = () => events.filter((e) => e.kind === 'subscription-activated').length;
      await stream.poll(failing); // 1-я неудача: повтор без паузы
      await stream.poll(failing); // 2-я неудача: пауза 2 × опрос = 2 с
      expect(activations()).toBe(2);
      await stream.poll(failing); // пауза идёт — попытки нет
      expect(activations()).toBe(2);
      jest.setSystemTime(Date.now() + 2_001);
      await stream.poll(failing);
      expect(activations()).toBe(3);
    } finally {
      jest.useRealTimers();
    }
  });

  it('break: пока идёт пауза после неудачи, подписка не считается установленной и не даёт subscription-expired при отмене', async () => {
    const { stream, events } = build();
    const failing = jest.fn(async (e: AppsContractEvent) => {
      events.push(e);
      throw new Error('healthcheck timeout');
    });
    await stream.poll(failing);
    await stream.poll(failing);
    await stream.poll(failing); // пауза: подписка отложена
    active.length = 0; // подписку отменили, так и не установив
    await stream.poll(failing);
    expect(events.filter((e) => e.kind === 'subscription-expired')).toHaveLength(0);
  });

  it('happy: после удачной установки счётчик неудач сброшен — новая неудача снова повторяется сразу', async () => {
    const { stream, events } = build();
    let fail = true;
    const flaky = jest.fn(async (e: AppsContractEvent) => {
      events.push(e);
      if (fail) throw new Error('docker pull failed');
    });
    await stream.poll(flaky); // неудача
    fail = false;
    await stream.poll(flaky); // удача
    expect(events.filter((e) => e.kind === 'subscription-activated')).toHaveLength(2);
    await stream.poll(flaky); // установлено — повторной активации нет
    expect(events.filter((e) => e.kind === 'subscription-activated')).toHaveLength(2);
  });

  // Подписку отменили, пока оркестратор был выключен: после старта он не
  // знает про неё, а контейнер приложения работает дальше (25.11.2026).
  it('happy: приложение стоит на узле без действующей подписки — первый опрос даёт subscription-expired', async () => {
    active.length = 0;
    const { stream, events, handler } = build(1, async () => ['@voskhod/orphan']);
    await stream.poll(handler);
    expect(events).toEqual([
      expect.objectContaining({ kind: 'subscription-expired', packageId: '@voskhod/orphan' }),
    ]);
  });

  it('break: приложение стоит и подписка действует — первый опрос его не снимает, а активирует как обычно', async () => {
    const { stream, events, handler } = build(1, async () => [PKG]);
    await stream.poll(handler);
    expect(events.map((e) => e.kind)).toEqual(['subscription-activated']);
  });

  it('break: список установленного читается только первым опросом — позже установленное вручную не снимается', async () => {
    let installed: string[] = [];
    const { stream, events, handler } = build(1, async () => installed);
    await stream.poll(handler);
    installed = ['@voskhod/later'];
    await stream.poll(handler);
    expect(events.filter((e) => e.kind === 'subscription-expired')).toHaveLength(0);
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

  // 487-37: обновление, которое ждёт согласия председателя, повторяется.
  it('break: обработчик обновления упал — версия возвращается, следующий опрос выпусков повторяет обновление', async () => {
    const { stream, events, handler } = build();
    await stream.poll(handler); // снимок
    await stream.poll(handler); // первое наблюдение 1.0.0
    latest = '1.1.0';
    const failing = async (e: AppsContractEvent): Promise<void> => {
      events.push(e);
      if (e.kind === 'release-published') throw new Error('ждёт согласия');
    };
    await stream.poll(failing);
    await stream.poll(handler);
    const published = events.filter((e) => e.kind === 'release-published');
    expect(published).toHaveLength(2);
    expect(published[1]).toEqual(expect.objectContaining({ packageId: PKG, version: '1.1.0' }));
    // Обновление установлено — третьего события нет.
    await stream.poll(handler);
    expect(events.filter((e) => e.kind === 'release-published')).toHaveLength(2);
  });

  it('happy: сигнал повторной установки — версии сверяются ближайшим опросом, не дожидаясь планового', async () => {
    const { stream, handler, versions } = build(50);
    await stream.poll(handler); // снимок
    await stream.poll(handler);
    expect(versions.latestVersion).not.toHaveBeenCalled();
    stream.recheck(PKG);
    await stream.poll(handler);
    expect(versions.latestVersion).toHaveBeenCalledTimes(1);
    // Сигнал разовый: следующий опрос версии не сверяет.
    await stream.poll(handler);
    expect(versions.latestVersion).toHaveBeenCalledTimes(1);
  });

  it('happy: сигнал повторной установки снимает паузу после неудачной установки', async () => {
    const { stream, events, handler } = build(50);
    const failing = async (e: AppsContractEvent): Promise<void> => {
      events.push(e);
      throw new Error('ждёт согласия');
    };
    await stream.poll(failing); // неудача 1 — повтор следующим опросом
    await stream.poll(failing); // неудача 2 — пауза 2 с
    const before = events.filter((e) => e.kind === 'subscription-activated').length;
    await stream.poll(handler); // пауза идёт: события нет
    expect(events.filter((e) => e.kind === 'subscription-activated')).toHaveLength(before);
    stream.recheck(PKG);
    await stream.poll(handler);
    expect(events.filter((e) => e.kind === 'subscription-activated')).toHaveLength(before + 1);
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

  // До 26.11.2026 оркестратор помнил установленное только в памяти: контейнер,
  // удалённый или остановленный мимо него, не работал до перезапуска оркестратора.
  describe('сверка с работающими контейнерами', () => {
    const activations = (events: AppsContractEvent[]) =>
      events.filter((e) => e.kind === 'subscription-activated').length;

    it('happy: контейнер приложения исчез — следующий опрос ставит приложение заново', async () => {
      let running: string[] = [];
      const { stream, events, handler } = build(1000, undefined, async () => running);
      await stream.poll(handler); // установка
      running = [PKG];
      await stream.poll(handler); // контейнер замечен работающим
      expect(activations(events)).toBe(1);
      running = [];
      await stream.poll(handler);
      expect(activations(events)).toBe(2);
    });

    it('side: контейнер работает — повторной установки нет ни на одном опросе', async () => {
      const { stream, events, handler } = build(1000, undefined, async () => [PKG]);
      await stream.poll(handler);
      await stream.poll(handler);
      await stream.poll(handler);
      expect(activations(events)).toBe(1);
    });

    it('side: приложение без бэкенда (контейнера не было никогда) не переустанавливается', async () => {
      const { stream, events, handler } = build(1000, undefined, async () => []);
      await stream.poll(handler);
      await stream.poll(handler);
      await stream.poll(handler);
      expect(activations(events)).toBe(1);
    });

    it('break: повторная установка упала — действует пауза повтора, шторма установок нет', async () => {
      let running: string[] = [PKG];
      const { stream, handler } = build(1000, undefined, async () => running);
      await stream.poll(handler);
      await stream.poll(handler);
      running = [];
      handler.mockRejectedValue(new Error('docker pull: нет сети'));
      const before = handler.mock.calls.length;
      await stream.poll(handler); // 1-я попытка
      await stream.poll(handler); // 2-я — сразу
      await stream.poll(handler); // пауза
      await stream.poll(handler); // пауза
      expect(handler.mock.calls.length - before).toBe(2);
    });

    it('side: подписка закончилась — контейнер снимается обычным путём, сверка его не возвращает', async () => {
      let running: string[] = [PKG];
      const { stream, events, handler } = build(1000, undefined, async () => running);
      await stream.poll(handler);
      await stream.poll(handler);
      active = [];
      running = [];
      await stream.poll(handler);
      await stream.poll(handler);
      expect(activations(events)).toBe(1);
      expect(events.filter((e) => e.kind === 'subscription-expired')).toHaveLength(1);
    });
  });
});
