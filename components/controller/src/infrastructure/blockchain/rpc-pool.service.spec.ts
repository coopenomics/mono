import { isFailoverWorthy, rpcBackoffMs, RpcPool } from './rpc-pool.service';

const logger = { warn: jest.fn(), info: jest.fn(), log: jest.fn(), error: jest.fn() } as any;

function makeEp(url: string, client: any, healthy = true) {
  return { url, client, healthy, failures: 0, nextProbeAt: 0 };
}

/** Пул с подменёнными endpoint'ами (минуем config-конструктор). */
function poolWith(endpoints: any[], now = 1_000_000): RpcPool {
  const pool = new RpcPool(logger);
  (pool as any).endpoints = endpoints;
  (pool as any).activeIndex = 0;
  (pool as any).now = () => now;
  return pool;
}

describe('rpcBackoffMs — экспоненциальный backoff 1с/2с/4с/8с (cap 8с)', () => {
  it.each([
    [0, 1000],
    [1, 1000],
    [2, 2000],
    [3, 4000],
    [4, 8000],
    [5, 8000],
    [10, 8000],
  ])('failures=%i → %iмс', (failures, expected) => {
    expect(rpcBackoffMs(failures)).toBe(expected);
  });
});

describe('isFailoverWorthy — транспортные ошибки failover-достойны, прикладные 4xx нет', () => {
  it('сеть/таймаут (нет response) → true', () => {
    expect(isFailoverWorthy(new Error('ECONNREFUSED'))).toBe(true);
  });
  it('5xx → true', () => {
    expect(isFailoverWorthy({ response: { status: 500 } })).toBe(true);
    expect(isFailoverWorthy({ response: { status: 503 } })).toBe(true);
  });
  it('429 → true', () => {
    expect(isFailoverWorthy({ response: { status: 429 } })).toBe(true);
  });
  it('прикладные 4xx → false', () => {
    expect(isFailoverWorthy({ response: { status: 404 } })).toBe(false);
    expect(isFailoverWorthy({ response: { status: 400 } })).toBe(false);
  });
});

describe('RpcPool.read — sticky primary + failover', () => {
  it('успех на active → возвращает результат, active не меняется', async () => {
    const ep0 = makeEp('u0', { read: jest.fn().mockResolvedValue('r0') });
    const ep1 = makeEp('u1', { read: jest.fn().mockResolvedValue('r1') });
    const pool = poolWith([ep0, ep1]);

    const res = await pool.read((c: any) => c.read());

    expect(res).toBe('r0');
    expect(ep1.client.read).not.toHaveBeenCalled();
    expect((pool as any).activeIndex).toBe(0);
  });

  it('транспортный сбой active → переключение на следующий здоровый, active сдвигается, узел помечен недоступным', async () => {
    const ep0 = makeEp('u0', { read: jest.fn().mockRejectedValue(new Error('down')) });
    const ep1 = makeEp('u1', { read: jest.fn().mockResolvedValue('r1') });
    const pool = poolWith([ep0, ep1]);

    const res = await pool.read((c: any) => c.read());

    expect(res).toBe('r1');
    expect(ep0.client.read).toHaveBeenCalledTimes(1);
    expect(ep1.client.read).toHaveBeenCalledTimes(1);
    expect(ep0.healthy).toBe(false);
    expect(ep0.failures).toBe(1);
    expect(ep0.nextProbeAt).toBe(1_000_000 + 1000); // backoff 1с от now
    expect((pool as any).activeIndex).toBe(1);
  });

  it('прикладная 4xx на active → проброс без перебора (узел здоров)', async () => {
    const ep0 = makeEp('u0', { read: jest.fn().mockRejectedValue({ response: { status: 404 } }) });
    const ep1 = makeEp('u1', { read: jest.fn().mockResolvedValue('r1') });
    const pool = poolWith([ep0, ep1]);

    await expect(pool.read((c: any) => c.read())).rejects.toMatchObject({ response: { status: 404 } });
    expect(ep1.client.read).not.toHaveBeenCalled();
    expect(ep0.healthy).toBe(true);
  });

  it('все узлы недоступны → бросает последнюю ошибку', async () => {
    const ep0 = makeEp('u0', { read: jest.fn().mockRejectedValue(new Error('down0')) });
    const ep1 = makeEp('u1', { read: jest.fn().mockRejectedValue(new Error('down1')) });
    const pool = poolWith([ep0, ep1]);

    await expect(pool.read((c: any) => c.read())).rejects.toThrow('down1');
    expect(ep0.healthy).toBe(false);
    expect(ep1.healthy).toBe(false);
  });

  it('здоровые пробуются раньше недоступных', async () => {
    const ep0 = makeEp('u0', { read: jest.fn().mockResolvedValue('r0') }, false); // недоступен
    const ep1 = makeEp('u1', { read: jest.fn().mockResolvedValue('r1') }, true);
    const pool = poolWith([ep0, ep1]);

    const res = await pool.read((c: any) => c.read());

    expect(res).toBe('r1'); // здоровый ep1 раньше недоступного ep0
    expect(ep0.client.read).not.toHaveBeenCalled();
  });
});

describe('RpcPool.readFromHealthy — сэмплы для консенсуса (Story 9.7)', () => {
  it('возвращает по сэмплу с каждого здорового узла', async () => {
    const ep0 = makeEp('u0', { read: jest.fn().mockResolvedValue('A') });
    const ep1 = makeEp('u1', { read: jest.fn().mockResolvedValue('B') });
    const pool = poolWith([ep0, ep1]);

    const samples = await pool.readFromHealthy(2, (c: any) => c.read());

    expect(samples).toEqual([
      { url: 'u0', value: 'A' },
      { url: 'u1', value: 'B' },
    ]);
  });

  it('сбойные узлы молча отброшены', async () => {
    const ep0 = makeEp('u0', { read: jest.fn().mockResolvedValue('A') });
    const ep1 = makeEp('u1', { read: jest.fn().mockRejectedValue(new Error('down')) });
    const pool = poolWith([ep0, ep1]);

    const samples = await pool.readFromHealthy(2, (c: any) => c.read());

    expect(samples).toEqual([{ url: 'u0', value: 'A' }]);
  });
});

describe('RpcPool.probeAll — health-check по get_info с учётом backoff', () => {
  function infoClient(ok: boolean) {
    return { v1: { chain: { get_info: jest.fn(ok ? () => Promise.resolve({}) : () => Promise.reject(new Error('down'))) } } };
  }

  it('живой узел → healthy, мёртвый → unhealthy + backoff', async () => {
    const ep0 = makeEp('u0', infoClient(true));
    const ep1 = makeEp('u1', infoClient(false));
    const pool = poolWith([ep0, ep1], 5_000_000);

    await (pool as any).probeAll();

    expect(ep0.healthy).toBe(true);
    expect(ep1.healthy).toBe(false);
    expect(ep1.nextProbeAt).toBe(5_000_000 + 1000);
  });

  it('недоступный узел в backoff-cooldown не переопрашивается', async () => {
    const ep0 = makeEp('u0', infoClient(true));
    const ep1 = makeEp('u1', infoClient(true), false);
    ep1.nextProbeAt = 9_999_999; // cooldown ещё не истёк
    const pool = poolWith([ep0, ep1], 5_000_000);

    await (pool as any).probeAll();

    expect(ep1.client.v1.chain.get_info).not.toHaveBeenCalled();
    expect(ep1.healthy).toBe(false); // остался недоступным
  });

  it('восстановившийся узел (cooldown истёк) → healthy, счётчик сброшен', async () => {
    const ep1 = makeEp('u1', infoClient(true), false);
    ep1.failures = 3;
    ep1.nextProbeAt = 4_000_000; // истёк (now=5_000_000)
    const pool = poolWith([ep1], 5_000_000);

    await (pool as any).probeAll();

    expect(ep1.healthy).toBe(true);
    expect(ep1.failures).toBe(0);
  });
});
