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
  async compose(subgraphs: ReadonlyArray<SubgraphDescriptor>): Promise<string> {
    this.calls.push(subgraphs.slice());
    if (this.error) throw this.error;
    const sdl = `# supergraph v${this.calls.length}\n${subgraphs.map((s) => s.name).join(',')}`;
    this.results.push(sdl);
    return sdl;
  }
}

const flushMicrotasks = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
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
});
