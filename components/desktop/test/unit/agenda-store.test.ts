import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

/**
 * Загрузка повестки совета.
 *
 * Случай 16.10.2026 (стенд 5): председатель открыл вопрос № 3 из оповещения о новом
 * решении и увидел «вопроса нет», а через пару секунд вопрос появился. Живое
 * обновление повестки (скрытое) сбрасывало флаг загрузки в начале — каркас первой
 * загрузки гас, пока список ещё грузился.
 */
const m = vi.hoisted(() => ({ loadAgenda: vi.fn() }));
vi.mock('src/entities/Agenda/api', () => ({ api: { loadAgenda: m.loadAgenda } }));

const { useAgendaStore } = await import('src/entities/Agenda/model/store');

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

const question = (id: number) => ({ table: { id } }) as never;

describe('useAgendaStore.loadAgenda', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    m.loadAgenda.mockReset();
  });

  it('скрытое обновление во время первой загрузки не гасит флаг загрузки', async () => {
    const first = deferred<unknown[]>();
    const hidden = deferred<unknown[]>();
    m.loadAgenda.mockReturnValueOnce(first.promise).mockReturnValueOnce(hidden.promise);
    const store = useAgendaStore();

    const visibleLoad = store.loadAgenda({ coopname: 'voskhod' });
    expect(store.loading).toBe(true);

    const hiddenLoad = store.refresh({ coopname: 'voskhod' });
    expect(store.loading).toBe(true);

    hidden.resolve([question(1), question(3)]);
    await hiddenLoad;
    expect(store.loading).toBe(true);

    first.resolve([question(1), question(3)]);
    await visibleLoad;
    expect(store.loading).toBe(false);
  });

  it('ответ более раннего запроса, пришедший позже, не затирает свежий список', async () => {
    const stale = deferred<unknown[]>();
    const fresh = deferred<unknown[]>();
    m.loadAgenda.mockReturnValueOnce(stale.promise).mockReturnValueOnce(fresh.promise);
    const store = useAgendaStore();

    const staleLoad = store.refresh({ coopname: 'voskhod' });
    const freshLoad = store.loadAgenda({ coopname: 'voskhod' });

    fresh.resolve([question(1), question(3)]);
    await freshLoad;
    stale.resolve([question(1)]);
    await staleLoad;

    expect(store.agenda.map((item: { table: { id: number } }) => item.table.id)).toEqual([1, 3]);
    expect(store.loading).toBe(false);
  });

  it('ошибка первой загрузки снимает флаг загрузки', async () => {
    m.loadAgenda.mockRejectedValueOnce(new Error('сеть'));
    const store = useAgendaStore();

    await expect(store.loadAgenda({ coopname: 'voskhod' })).rejects.toThrow('сеть');
    expect(store.loading).toBe(false);
  });
});
