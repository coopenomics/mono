/**
 * Unit-тесты ForkRegistryService (Story 4.1, ADR-005).
 *
 * Контрактные инварианты:
 * - runAll обходит syncer'ов строго sequential (for-of await, не Promise.all) — INV-T03.
 * - Любая ошибка re-throw'ится наверх (silent catch ломает barrier-контракт parser2).
 * - register идемпотентен (повторная регистрация того же экземпляра — no-op).
 * - forkRollbackPriority перекрывает порядок регистрации (FK-зависимости).
 * - onApplicationBootstrap собирает провайдеров с FORK_AWARE_MARKER через DiscoveryService.
 */

import { ForkRegistryService } from '~/shared/sync/fork/fork-registry.service';
import { FORK_AWARE_MARKER, type IForkAwareSyncer } from '@coopenomics/extension-kit/sync';

function makeLoggerStub(): any {
  return {
    setContext: jest.fn(),
    log: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

function makeDiscoveryStub(providers: Array<{ instance: unknown }>): any {
  return { getProviders: jest.fn(() => providers) };
}

class FakeSyncer implements IForkAwareSyncer {
  readonly [FORK_AWARE_MARKER] = true;
  readonly trace: number[] = [];
  constructor(public readonly id: number, public readonly forkRollbackPriority?: number) {}
  async handleFork(blockNum: number): Promise<void> {
    this.trace.push(blockNum);
  }
}

describe('ForkRegistryService (Story 4.1)', () => {
  describe('register / unregister / size', () => {
    it('register добавляет syncer; size отражает количество', () => {
      const service = new ForkRegistryService(makeDiscoveryStub([]), makeLoggerStub());
      const a = new FakeSyncer(1);
      const b = new FakeSyncer(2);

      expect(service.size()).toBe(0);
      service.register(a);
      service.register(b);
      expect(service.size()).toBe(2);
    });

    it('register идемпотентен: повторная регистрация того же экземпляра — no-op', () => {
      const service = new ForkRegistryService(makeDiscoveryStub([]), makeLoggerStub());
      const a = new FakeSyncer(1);

      service.register(a);
      service.register(a);
      service.register(a);
      expect(service.size()).toBe(1);
    });

    it('unregister снимает syncer; повторный unregister отсутствующего — no-op', () => {
      const service = new ForkRegistryService(makeDiscoveryStub([]), makeLoggerStub());
      const a = new FakeSyncer(1);
      service.register(a);

      service.unregister(a);
      expect(service.size()).toBe(0);
      service.unregister(a);
      expect(service.size()).toBe(0);
    });

    it('clear обнуляет реестр', () => {
      const service = new ForkRegistryService(makeDiscoveryStub([]), makeLoggerStub());
      service.register(new FakeSyncer(1));
      service.register(new FakeSyncer(2));

      service.clear();
      expect(service.size()).toBe(0);
    });
  });

  describe('runAll — sequential apply', () => {
    it('обходит syncer-ов в порядке регистрации', async () => {
      const service = new ForkRegistryService(makeDiscoveryStub([]), makeLoggerStub());
      const order: number[] = [];
      const a: IForkAwareSyncer = {
        [FORK_AWARE_MARKER]: true,
        async handleFork() {
          order.push(1);
        },
      } as any;
      const b: IForkAwareSyncer = {
        [FORK_AWARE_MARKER]: true,
        async handleFork() {
          order.push(2);
        },
      } as any;
      const c: IForkAwareSyncer = {
        [FORK_AWARE_MARKER]: true,
        async handleFork() {
          order.push(3);
        },
      } as any;
      service.register(a);
      service.register(b);
      service.register(c);

      await service.runAll(100);

      expect(order).toEqual([1, 2, 3]);
    });

    it('каждый syncer стартует ТОЛЬКО после resolve предыдущего (NOT Promise.all)', async () => {
      const service = new ForkRegistryService(makeDiscoveryStub([]), makeLoggerStub());
      const events: string[] = [];
      const slow: IForkAwareSyncer = {
        [FORK_AWARE_MARKER]: true,
        async handleFork() {
          events.push('slow:start');
          await new Promise((r) => setTimeout(r, 20));
          events.push('slow:end');
        },
      } as any;
      const fast: IForkAwareSyncer = {
        [FORK_AWARE_MARKER]: true,
        async handleFork() {
          events.push('fast:start');
          events.push('fast:end');
        },
      } as any;
      service.register(slow);
      service.register(fast);

      await service.runAll(100);

      expect(events).toEqual(['slow:start', 'slow:end', 'fast:start', 'fast:end']);
    });

    it('runAll прокидывает blockNum в handleFork каждого syncer-а', async () => {
      const service = new ForkRegistryService(makeDiscoveryStub([]), makeLoggerStub());
      const a = new FakeSyncer(1);
      const b = new FakeSyncer(2);
      service.register(a);
      service.register(b);

      await service.runAll(12345);

      expect(a.trace).toEqual([12345]);
      expect(b.trace).toEqual([12345]);
    });

    it('пустой registry: runAll — no-op (без ошибок)', async () => {
      const service = new ForkRegistryService(makeDiscoveryStub([]), makeLoggerStub());
      await expect(service.runAll(100)).resolves.toBeUndefined();
    });
  });

  describe('runAll — error propagation', () => {
    it('первая ошибка пробрасывается наверх; последующие syncer-ы НЕ запускаются', async () => {
      const service = new ForkRegistryService(makeDiscoveryStub([]), makeLoggerStub());
      const trace: string[] = [];
      const ok1: IForkAwareSyncer = {
        [FORK_AWARE_MARKER]: true,
        async handleFork() {
          trace.push('ok1');
        },
      } as any;
      const fail: IForkAwareSyncer = {
        [FORK_AWARE_MARKER]: true,
        async handleFork() {
          trace.push('fail');
          throw new Error('rollback failed');
        },
      } as any;
      const ok2: IForkAwareSyncer = {
        [FORK_AWARE_MARKER]: true,
        async handleFork() {
          trace.push('ok2');
        },
      } as any;
      service.register(ok1);
      service.register(fail);
      service.register(ok2);

      await expect(service.runAll(100)).rejects.toThrow('rollback failed');
      expect(trace).toEqual(['ok1', 'fail']);
    });

    it('после ошибки registry остаётся валидным: повторный runAll проходит', async () => {
      const service = new ForkRegistryService(makeDiscoveryStub([]), makeLoggerStub());
      let attempt = 0;
      const flaky: IForkAwareSyncer = {
        [FORK_AWARE_MARKER]: true,
        async handleFork() {
          attempt += 1;
          if (attempt === 1) throw new Error('first fail');
        },
      } as any;
      service.register(flaky);

      await expect(service.runAll(100)).rejects.toThrow('first fail');
      await expect(service.runAll(100)).resolves.toBeUndefined();
      expect(attempt).toBe(2);
    });
  });

  describe('forkRollbackPriority — порядок при FK-зависимостях', () => {
    it('syncer с приоритетом 1 идёт раньше syncer с приоритетом 5', async () => {
      const service = new ForkRegistryService(makeDiscoveryStub([]), makeLoggerStub());
      const trace: number[] = [];
      const low: IForkAwareSyncer = {
        [FORK_AWARE_MARKER]: true,
        forkRollbackPriority: 5,
        async handleFork() {
          trace.push(5);
        },
      } as any;
      const high: IForkAwareSyncer = {
        [FORK_AWARE_MARKER]: true,
        forkRollbackPriority: 1,
        async handleFork() {
          trace.push(1);
        },
      } as any;
      service.register(low);
      service.register(high);

      await service.runAll(100);

      expect(trace).toEqual([1, 5]);
    });

    it('syncer с приоритетом идёт раньше syncer без приоритета', async () => {
      const service = new ForkRegistryService(makeDiscoveryStub([]), makeLoggerStub());
      const trace: string[] = [];
      const noPrio: IForkAwareSyncer = {
        [FORK_AWARE_MARKER]: true,
        async handleFork() {
          trace.push('noPrio');
        },
      } as any;
      const prio: IForkAwareSyncer = {
        [FORK_AWARE_MARKER]: true,
        forkRollbackPriority: 0,
        async handleFork() {
          trace.push('prio');
        },
      } as any;
      service.register(noPrio);
      service.register(prio);

      await service.runAll(100);

      expect(trace).toEqual(['prio', 'noPrio']);
    });
  });

  describe('onApplicationBootstrap — pull-сбор через DiscoveryService', () => {
    it('собирает только провайдеров с FORK_AWARE_MARKER', async () => {
      const aware: IForkAwareSyncer = {
        [FORK_AWARE_MARKER]: true,
        async handleFork() {},
      } as any;
      const notAware = { handleFork: async () => {} }; // нет marker'а
      const someService = { someMethod: () => {} };
      const nullInstance = null;
      const discovery = makeDiscoveryStub([
        { instance: aware },
        { instance: notAware },
        { instance: someService },
        { instance: nullInstance },
      ]);
      const service = new ForkRegistryService(discovery, makeLoggerStub());

      await service.onApplicationBootstrap();

      expect(service.size()).toBe(1);
    });

    it('не падает при пустом списке провайдеров', async () => {
      const service = new ForkRegistryService(makeDiscoveryStub([]), makeLoggerStub());
      await expect(service.onApplicationBootstrap()).resolves.toBeUndefined();
      expect(service.size()).toBe(0);
    });

    it('игнорирует FORK_AWARE_MARKER без handleFork (защита от ложного срабатывания)', async () => {
      const fake = { [FORK_AWARE_MARKER]: true }; // marker есть, метода нет
      const discovery = makeDiscoveryStub([{ instance: fake }]);
      const service = new ForkRegistryService(discovery, makeLoggerStub());

      await service.onApplicationBootstrap();

      expect(service.size()).toBe(0);
    });
  });
});
