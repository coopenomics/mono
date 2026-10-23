/**
 * @fileoverview Юнит-тесты ChainRpcAppsEventStream (Story 10.5b):
 * синтез событий из диффа таблиц apps-контракта без сети — транспорт
 * `post()` подменён фикстурами.
 */
import { ChainRpcAppsEventStream } from './chain-rpc-event-stream.impl';
import type { AppsContractEvent } from './ports';

type Tables = {
  packages: Array<{ package_id: string; package_name?: string }>;
  releases: Array<{
    id: number;
    package_id: string;
    version: string;
    scope: { kind: string; targets: string[] };
    status: string;
  }>;
  subs: Array<{
    id: number;
    coopname: string;
    package_id: string;
    active: boolean;
    end_at: string;
  }>;
};

class FakeChainStream extends ChainRpcAppsEventStream {
  tables: Tables = { packages: [], releases: [], subs: [] };
  now = 1_000_000;

  protected override nowSec(): number {
    return this.now;
  }

  protected override async post(path: string, body: unknown): Promise<unknown> {
    if (path === '/v1/chain/get_info') {
      return { head_block_num: 42 };
    }
    const table = (body as { table: keyof Tables }).table;
    return { rows: this.tables[table], more: false };
  }
}

const FUTURE = '2999-01-01T00:00:00';
const PAST = '1970-01-02T00:00:00';

const build = () =>
  new FakeChainStream({
    rpcUrl: 'http://node:8888',
    contractAccount: 'apps',
    coopname: 'voskhod',
    pollIntervalMs: 1000,
  });

const collect = async (stream: FakeChainStream): Promise<AppsContractEvent[]> => {
  const events: AppsContractEvent[] = [];
  await stream.poll(async (e) => {
    events.push(e);
  });
  return events;
};

describe('ChainRpcAppsEventStream', () => {
  it('initial-снапшот: subscription-activated только для нашего коопа, релизы молчат', async () => {
    const s = build();
    s.tables.packages = [{ package_id: 'demoapp', package_name: '@voskhod/demoapp' }];
    s.tables.releases = [
      { id: 1, package_id: 'demoapp', version: '1.0.0', scope: { kind: 'all', targets: [] }, status: 'active' },
    ];
    s.tables.subs = [
      { id: 1, coopname: 'voskhod', package_id: 'demoapp', active: true, end_at: FUTURE },
      { id: 2, coopname: 'alpha', package_id: 'demoapp', active: true, end_at: FUTURE },
      { id: 3, coopname: 'voskhod', package_id: 'demoapp', active: false, end_at: FUTURE },
    ];
    const events = await collect(s);
    expect(events).toEqual([
      {
        kind: 'subscription-activated',
        coopname: 'voskhod',
        packageId: '@voskhod/demoapp',
        expiresAtUnix: Date.parse(`${FUTURE}Z`) / 1000,
        blockNum: 42,
      },
    ]);
  });

  it('новый active-релиз после initial → release-published с npm-именем и scope-маппингом', async () => {
    const s = build();
    s.tables.packages = [{ package_id: 'demoapp', package_name: '@voskhod/demoapp' }];
    await collect(s); // initial
    s.tables.releases = [
      {
        id: 1,
        package_id: 'demoapp',
        version: '1.2.0',
        scope: { kind: 'canary', targets: ['voskhod', 'alpha'] },
        status: 'active',
      },
    ];
    const events = await collect(s);
    expect(events).toEqual([
      {
        kind: 'release-published',
        packageId: '@voskhod/demoapp',
        version: '1.2.0',
        scopeType: 'cooperatives',
        scopeCoopnames: ['voskhod', 'alpha'],
        blockNum: 42,
      },
    ]);
    // повторный poll без изменений — тишина
    expect(await collect(s)).toEqual([]);
  });

  it('withdraw релиза → release-withdrawn', async () => {
    const s = build();
    s.tables.releases = [
      { id: 1, package_id: 'demoapp', version: '1.0.0', scope: { kind: 'all', targets: [] }, status: 'active' },
    ];
    await collect(s);
    s.tables.releases = [
      { id: 1, package_id: 'demoapp', version: '1.0.0', scope: { kind: 'all', targets: [] }, status: 'withdrawn' },
    ];
    const events = await collect(s);
    expect(events).toEqual([
      { kind: 'release-withdrawn', packageId: 'demoapp', version: '1.0.0', blockNum: 42 },
    ]);
  });

  it('новая подписка → subscription-activated; продление end_at → повторное событие', async () => {
    const s = build();
    await collect(s);
    s.tables.subs = [
      { id: 1, coopname: 'alpha', package_id: 'demoapp', active: true, end_at: FUTURE },
    ];
    expect((await collect(s)).map((e) => e.kind)).toEqual(['subscription-activated']);
    // продление
    s.tables.subs = [
      { id: 1, coopname: 'alpha', package_id: 'demoapp', active: true, end_at: '2999-06-01T00:00:00' },
    ];
    expect((await collect(s)).map((e) => e.kind)).toEqual(['subscription-activated']);
  });

  it('подписка истекла по часам (без изменения row) → subscription-expired', async () => {
    const s = build();
    const endAt = '2000-01-01T00:00:00';
    s.now = Date.parse(`${endAt}Z`) / 1000 - 100;
    s.tables.subs = [
      { id: 1, coopname: 'voskhod', package_id: 'demoapp', active: true, end_at: endAt },
    ];
    await collect(s); // initial: live
    s.now = Date.parse(`${endAt}Z`) / 1000 + 100;
    const events = await collect(s);
    expect(events).toEqual([
      { kind: 'subscription-expired', coopname: 'voskhod', packageId: 'demoapp', blockNum: 42 },
    ]);
  });

  it('expsub (active=false) → subscription-expired один раз', async () => {
    const s = build();
    s.tables.subs = [
      { id: 1, coopname: 'voskhod', package_id: 'demoapp', active: true, end_at: FUTURE },
    ];
    await collect(s);
    s.tables.subs = [
      { id: 1, coopname: 'voskhod', package_id: 'demoapp', active: false, end_at: FUTURE },
    ];
    expect((await collect(s)).map((e) => e.kind)).toEqual(['subscription-expired']);
    expect(await collect(s)).toEqual([]);
  });

  it('давно истёкшая подписка на initial-снапшоте не активируется', async () => {
    const s = build();
    s.tables.subs = [
      { id: 1, coopname: 'voskhod', package_id: 'demoapp', active: true, end_at: PAST },
    ];
    expect(await collect(s)).toEqual([]);
  });
});
