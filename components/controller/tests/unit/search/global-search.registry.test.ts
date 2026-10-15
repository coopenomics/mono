/**
 * Реестр единого поиска: опрос поставщиков окна столов и страниц.
 *
 * Что здесь защищается. Окно шлёт один запрос, реестр опрашивает всех
 * поставщиков параллельно. Медленный или упавший поставщик не должен ни
 * задержать ответ, ни уронить его: остальные группы приходят, а сбойная
 * помечается, чтобы окно сказало, что поиск по ней неполон.
 *
 * Реестр случаев: test-registry/platform.global-search.yaml
 */

import type { IGlobalSearchHook, InnerGlobalSearchContext, InnerGlobalSearchHit } from '@coopenomics/innercoop';
import {
  GLOBAL_SEARCH_PROVIDER_TIMEOUT_MS,
  GlobalSearchGroupStatus,
  GlobalSearchRegistry,
} from '~/application/search/global-search.registry';

const CONTEXT: InnerGlobalSearchContext = { coopname: 'voskhod', username: 'ant', userRole: 'chairman' };

function hit(key: string): InnerGlobalSearchHit {
  return { key, title: key, route: { name: 'somewhere' } };
}

function provider(
  key: string,
  order: number,
  search: IGlobalSearchHook['search']
): IGlobalSearchHook & { search: jest.Mock } {
  return { extensionName: 'core', key, title: key, icon: 'search', order, search: jest.fn(search) };
}

describe('GlobalSearchRegistry', () => {
  afterEach(() => jest.useRealTimers());

  it('опрашивает поставщиков и отдаёт группы по порядку, передавая запрос без пробелов и пайщика', async () => {
    const registry = new GlobalSearchRegistry();
    const documents = provider('documents', 20, async () => [hit('d1')]);
    const participants = provider('participants', 10, async () => [hit('p1')]);
    registry.register(documents);
    registry.register(participants);

    const groups = await registry.search('  Иван  ', CONTEXT, 5);

    expect(groups.map((g) => g.key)).toEqual(['participants', 'documents']);
    expect(groups.every((g) => g.status === GlobalSearchGroupStatus.OK)).toBe(true);
    expect(participants.search).toHaveBeenCalledWith('Иван', CONTEXT, 5);
  });

  it('короткий запрос не уходит поставщикам', async () => {
    const registry = new GlobalSearchRegistry();
    const participants = provider('participants', 10, async () => [hit('p1')]);
    registry.register(participants);

    expect(await registry.search(' и ', CONTEXT, 5)).toEqual([]);
    expect(participants.search).not.toHaveBeenCalled();
  });

  it('группы без находок не возвращаются, лишние находки отрезаются по пределу', async () => {
    const registry = new GlobalSearchRegistry();
    registry.register(provider('empty', 10, async () => []));
    registry.register(provider('many', 20, async () => [hit('a'), hit('b'), hit('c')]));

    const groups = await registry.search('запрос', CONTEXT, 2);

    expect(groups.map((g) => g.key)).toEqual(['many']);
    expect(groups[0].hits.map((h) => h.key)).toEqual(['a', 'b']);
  });

  it('упавший поставщик помечается ошибкой, остальные группы приходят', async () => {
    const registry = new GlobalSearchRegistry();
    registry.register(provider('broken', 10, async () => Promise.reject(new Error('база недоступна'))));
    registry.register(provider('documents', 20, async () => [hit('d1')]));

    const groups = await registry.search('запрос', CONTEXT, 5);

    expect(groups).toEqual([
      expect.objectContaining({ key: 'broken', status: GlobalSearchGroupStatus.ERROR, hits: [] }),
      expect.objectContaining({ key: 'documents', status: GlobalSearchGroupStatus.OK }),
    ]);
  });

  it('медленный поставщик не держит ответ: по пределу времени его группа помечается', async () => {
    jest.useFakeTimers();
    const registry = new GlobalSearchRegistry();
    registry.register(provider('slow', 10, () => new Promise<InnerGlobalSearchHit[]>(() => undefined)));
    registry.register(provider('documents', 20, async () => [hit('d1')]));

    const pending = registry.search('запрос', CONTEXT, 5);
    await jest.advanceTimersByTimeAsync(GLOBAL_SEARCH_PROVIDER_TIMEOUT_MS);
    const groups = await pending;

    expect(groups).toEqual([
      expect.objectContaining({ key: 'slow', status: GlobalSearchGroupStatus.TIMEOUT, hits: [] }),
      expect.objectContaining({ key: 'documents', status: GlobalSearchGroupStatus.OK }),
    ]);
  });
});
