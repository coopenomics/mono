/**
 * @fileoverview Юнит-тесты dynamic supergraph manager'а (Story 10.3b).
 *
 * Покрытие:
 *  1. initial compose: возвращает SDL, composer вызывается ровно один раз;
 *  2. tick без изменений в registry → composer НЕ вызывается, update НЕ вызывается;
 *  3. tick с новой subgraph-записью в registry → composer вызывается, update вызывается с новым SDL;
 *  4. tick с удалённой subgraph-записью → recompose;
 *  5. tick с изменённым URL у subgraph'а (рестарт сервиса на другом порту) → recompose;
 *  6. ошибка в composer'е на tick'е НЕ ломает следующий tick (continuity);
 *  7. cleanup() останавливает таймер — composer перестаёт вызываться.
 *
 * Используем jest fake timers для управления интервалом.
 */
import {
  createDynamicSupergraphManager,
  SupergraphComposerPort,
  SupergraphRegistryReader,
} from './supergraph-manager';
import type { SubgraphDescriptor } from './subgraph-registry.service';

class FakeRegistry implements SupergraphRegistryReader {
  current: SubgraphDescriptor[] = [];
  calls = 0;
  async listForCompose(): Promise<SubgraphDescriptor[]> {
    this.calls += 1;
    return this.current.slice();
  }
}

class FakeComposer implements SupergraphComposerPort {
  calls: Array<ReadonlyArray<SubgraphDescriptor>> = [];
  results: string[] = [];
  error?: Error;
  /** Недоступные части схемы: сборка с любой из них падает. */
  down = new Set<string>();
  async compose(subgraphs: ReadonlyArray<SubgraphDescriptor>): Promise<string> {
    this.calls.push(subgraphs.slice());
    if (this.error) throw this.error;
    const dead = subgraphs.find((s) => this.down.has(s.name));
    if (dead) throw new Error(`getaddrinfo EAI_AGAIN ${dead.name}`);
    const sdl = `# supergraph v${this.calls.length}\n${subgraphs.map((s) => s.name).join(',')}`;
    this.results.push(sdl);
    return sdl;
  }
}

const flushMicrotasks = async (): Promise<void> => {
  // Сборка с исключением недоступного приложения — цепочка из нескольких await.
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
};

const POLL_MS = 1000;

describe('createDynamicSupergraphManager', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('initial compose: возвращает SDL, composer вызывается ровно один раз', async () => {
    const registry = new FakeRegistry();
    registry.current = [{ name: 'core', url: 'http://core:3000/graphql' }];
    const composer = new FakeComposer();
    const updates: string[] = [];
    const lifecycle = await createDynamicSupergraphManager(
      { registry, composer, pollIntervalMs: POLL_MS },
      (sdl) => updates.push(sdl),
    );
    expect(composer.calls.length).toBe(1);
    expect(lifecycle.initialSdl).toBe('# supergraph v1\ncore');
    expect(updates).toEqual([]);
    await lifecycle.cleanup();
  });

  it('tick без изменений → composer НЕ вызывается, update НЕ вызывается', async () => {
    const registry = new FakeRegistry();
    registry.current = [{ name: 'core', url: 'http://core:3000/graphql' }];
    const composer = new FakeComposer();
    const updates: string[] = [];
    const lifecycle = await createDynamicSupergraphManager(
      { registry, composer, pollIntervalMs: POLL_MS },
      (sdl) => updates.push(sdl),
    );
    expect(composer.calls.length).toBe(1);
    jest.advanceTimersByTime(POLL_MS);
    await flushMicrotasks();
    expect(composer.calls.length).toBe(1); // не вызван повторно
    expect(updates).toEqual([]);
    await lifecycle.cleanup();
  });

  it('tick с новой subgraph-записью → composer вызывается, update получает новый SDL', async () => {
    const registry = new FakeRegistry();
    registry.current = [{ name: 'core', url: 'http://core:3000/graphql' }];
    const composer = new FakeComposer();
    const updates: string[] = [];
    const lifecycle = await createDynamicSupergraphManager(
      { registry, composer, pollIntervalMs: POLL_MS },
      (sdl) => updates.push(sdl),
    );
    registry.current.push({ name: 'chatcoop', url: 'http://chatcoop:3000/graphql' });
    jest.advanceTimersByTime(POLL_MS);
    await flushMicrotasks();
    expect(composer.calls.length).toBe(2);
    expect(updates).toEqual(['# supergraph v2\ncore,chatcoop']);
    await lifecycle.cleanup();
  });

  it('tick с удалённой subgraph-записью → recompose', async () => {
    const registry = new FakeRegistry();
    registry.current = [
      { name: 'core', url: 'http://core:3000/graphql' },
      { name: 'chatcoop', url: 'http://chatcoop:3000/graphql' },
    ];
    const composer = new FakeComposer();
    const updates: string[] = [];
    const lifecycle = await createDynamicSupergraphManager(
      { registry, composer, pollIntervalMs: POLL_MS },
      (sdl) => updates.push(sdl),
    );
    registry.current = [{ name: 'core', url: 'http://core:3000/graphql' }];
    jest.advanceTimersByTime(POLL_MS);
    await flushMicrotasks();
    expect(composer.calls.length).toBe(2);
    expect(updates).toEqual(['# supergraph v2\ncore']);
    await lifecycle.cleanup();
  });

  it('tick с изменённым URL у subgraph\'а → recompose', async () => {
    const registry = new FakeRegistry();
    registry.current = [{ name: 'chatcoop', url: 'http://chatcoop:3000/graphql' }];
    const composer = new FakeComposer();
    const updates: string[] = [];
    const lifecycle = await createDynamicSupergraphManager(
      { registry, composer, pollIntervalMs: POLL_MS },
      (sdl) => updates.push(sdl),
    );
    registry.current = [{ name: 'chatcoop', url: 'http://chatcoop-v2:3000/graphql' }];
    jest.advanceTimersByTime(POLL_MS);
    await flushMicrotasks();
    expect(composer.calls.length).toBe(2);
    expect(updates.length).toBe(1);
    await lifecycle.cleanup();
  });

  it('ошибка в composer\'е НЕ ломает следующий tick (continuity)', async () => {
    const registry = new FakeRegistry();
    registry.current = [{ name: 'core', url: 'http://core:3000/graphql' }];
    const composer = new FakeComposer();
    const updates: string[] = [];
    const lifecycle = await createDynamicSupergraphManager(
      { registry, composer, pollIntervalMs: POLL_MS },
      (sdl) => updates.push(sdl),
    );
    // tick 1 — добавили subgraph, composer бросает
    registry.current.push({ name: 'chatcoop', url: 'http://chatcoop:3000/graphql' });
    composer.error = new Error('introspection failed');
    jest.advanceTimersByTime(POLL_MS);
    await flushMicrotasks();
    expect(updates).toEqual([]);
    // tick 2 — composer оправился
    composer.error = undefined;
    jest.advanceTimersByTime(POLL_MS);
    await flushMicrotasks();
    expect(updates.length).toBe(1);
    await lifecycle.cleanup();
  });

  it('forceRefresh(): немедленный recompose без ожидания таймера', async () => {
    const registry = new FakeRegistry();
    registry.current = [{ name: 'core', url: 'http://core:3000/graphql' }];
    const composer = new FakeComposer();
    const updates: string[] = [];
    const lifecycle = await createDynamicSupergraphManager(
      { registry, composer, pollIntervalMs: POLL_MS },
      (sdl) => updates.push(sdl),
    );
    registry.current.push({ name: 'chatcoop', url: 'http://chatcoop:3000/graphql' });
    await expect(lifecycle.forceRefresh()).resolves.toBe(true);
    expect(updates).toEqual(['# supergraph v2\ncore,chatcoop']);
    // повторный вызов без изменений — recompose не нужен
    await expect(lifecycle.forceRefresh()).resolves.toBe(false);
    expect(composer.calls.length).toBe(2);
    await lifecycle.cleanup();
  });

  // Обновление версии приложения: имя и адрес в реестре прежние, схема другая.
  it('forceRecompose(): пересобирает схему при неизменном составе реестра', async () => {
    const registry = new FakeRegistry();
    registry.current = [{ name: 'core', url: 'http://core:3000/graphql' }];
    const composer = new FakeComposer();
    const updates: string[] = [];
    const lifecycle = await createDynamicSupergraphManager(
      { registry, composer, pollIntervalMs: POLL_MS },
      (sdl) => updates.push(sdl),
    );
    await expect(lifecycle.forceRefresh()).resolves.toBe(false);
    await lifecycle.forceRecompose();
    expect(updates).toHaveLength(1);
    expect(composer.calls.length).toBe(2);
    await lifecycle.cleanup();
  });

  it('cleanup() останавливает таймер — composer перестаёт вызываться', async () => {
    const registry = new FakeRegistry();
    registry.current = [{ name: 'core', url: 'http://core:3000/graphql' }];
    const composer = new FakeComposer();
    const lifecycle = await createDynamicSupergraphManager(
      { registry, composer, pollIntervalMs: POLL_MS },
      () => undefined,
    );
    await lifecycle.cleanup();
    registry.current.push({ name: 'chatcoop', url: 'http://chatcoop:3000/graphql' });
    jest.advanceTimersByTime(POLL_MS * 5);
    await flushMicrotasks();
    expect(composer.calls.length).toBe(1); // только initial
  });

  // До 26.11.2026 запись реестра о недоступном приложении роняла сборку
  // целиком: оркестратор не стартовал и перезапускался по кругу.
  describe('недоступное приложение', () => {
    const core = { name: 'core', url: 'http://core:3000/graphql' };
    const chat = { name: 'chatcoop', url: 'http://chatcoop:3000/graphql' };
    const shop = { name: 'shop', url: 'http://shop:3000/graphql' };

    it('happy: приложение недоступно при старте — схема собрана из ядра и доступных приложений', async () => {
      const registry = new FakeRegistry();
      registry.current = [core, chat, shop];
      const composer = new FakeComposer();
      composer.down.add('chatcoop');
      const lifecycle = await createDynamicSupergraphManager({ registry, composer, pollIntervalMs: POLL_MS }, () => undefined);
      expect(lifecycle.initialSdl.split('\n')[1]).toBe('core,shop');
      await lifecycle.cleanup();
    });

    it('happy: исключённое приложение поднялось — следующий такт подключает его без изменений в реестре', async () => {
      const registry = new FakeRegistry();
      registry.current = [core, chat];
      const composer = new FakeComposer();
      composer.down.add('chatcoop');
      const updates: string[] = [];
      const lifecycle = await createDynamicSupergraphManager(
        { registry, composer, pollIntervalMs: POLL_MS },
        (sdl) => updates.push(sdl),
      );
      // Такт, пока приложение лежит: состав схемы прежний — схему не трогаем.
      jest.advanceTimersByTime(POLL_MS);
      await flushMicrotasks();
      expect(updates).toEqual([]);
      composer.down.clear();
      jest.advanceTimersByTime(POLL_MS);
      await flushMicrotasks();
      expect(updates).toHaveLength(1);
      expect(updates[0].split('\n')[1]).toBe('core,chatcoop');
      await lifecycle.cleanup();
    });

    it('side: приложение упало на работающем шлюзе, реестр изменился — оно исключается, остальные остаются', async () => {
      const registry = new FakeRegistry();
      registry.current = [core, chat];
      const composer = new FakeComposer();
      const updates: string[] = [];
      const lifecycle = await createDynamicSupergraphManager(
        { registry, composer, pollIntervalMs: POLL_MS },
        (sdl) => updates.push(sdl),
      );
      composer.down.add('chatcoop');
      registry.current = [core, chat, shop];
      await expect(lifecycle.forceRefresh()).resolves.toBe(true);
      expect(updates[0].split('\n')[1]).toBe('core,shop');
      await lifecycle.cleanup();
    });

    it('break: недоступно ядро — сборки нет, отказ не маскируется исключением приложений', async () => {
      const registry = new FakeRegistry();
      registry.current = [core, chat];
      const composer = new FakeComposer();
      composer.down.add('core');
      await expect(
        createDynamicSupergraphManager({ registry, composer, pollIntervalMs: POLL_MS }, () => undefined),
      ).rejects.toThrow(/core/);
    });

    it('side: ядро записано под именем пакета (core-coopback) — оно тоже обязательно', async () => {
      const registry = new FakeRegistry();
      registry.current = [{ name: 'core-coopback', url: 'http://coopback:2998/v1/graphql' }, chat];
      const composer = new FakeComposer();
      composer.down.add('chatcoop');
      const lifecycle = await createDynamicSupergraphManager({ registry, composer, pollIntervalMs: POLL_MS }, () => undefined);
      expect(lifecycle.initialSdl.split('\n')[1]).toBe('core-coopback');
      await lifecycle.cleanup();
    });
  });
});
