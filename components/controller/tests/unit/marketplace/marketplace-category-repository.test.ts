/**
 * Защита базовых категорий платформы от удаления.
 *
 * Базовые категории (`mvp_baseline: true`, без привязки к кооперативу) — общий
 * справочник: кооператив может их выключить, но не удалить. Защита живёт в
 * условии удаления, а не в проверке «до»: адаптер удаляет строго собственную
 * строку кооператива, и если ничего не удалилось — резолвер отвечает «Базовую
 * категорию удалить нельзя».
 *
 * Тест страхует именно условие: потеря любого из трёх ключей фильтра
 * (id / coopname / mvp_baseline) открыла бы удаление чужих или общих категорий.
 */
import { MarketplaceCategoryRepositoryAdapter } from '~/extensions/marketplace/infrastructure/adapters/marketplace-category-repository.adapter';

const COOP = 'voskhod';

function makeAdapter(affected: number) {
  const repo = {
    delete: jest.fn().mockResolvedValue({ affected }),
  };
  const mapper = { toDomain: jest.fn() };
  const adapter = new MarketplaceCategoryRepositoryAdapter(
    repo as never,
    mapper as never
  );
  return { adapter, repo };
}

describe('MarketplaceCategoryRepositoryAdapter.deleteCustom', () => {
  it('удаляет строго собственную небазовую категорию кооператива', async () => {
    const { adapter, repo } = makeAdapter(1);

    const ok = await adapter.deleteCustom(COOP, 42);

    expect(ok).toBe(true);
    expect(repo.delete).toHaveBeenCalledWith({
      id: 42,
      coopname: COOP,
      mvp_baseline: false,
    });
  });

  it('ничего не удалилось → false (для базовой категории это и есть отказ)', async () => {
    const { adapter } = makeAdapter(0);

    await expect(adapter.deleteCustom(COOP, 1)).resolves.toBe(false);
  });

  it('undefined в affected трактуется как «не удалено», а не как успех', async () => {
    const repo = { delete: jest.fn().mockResolvedValue({}) };
    const adapter = new MarketplaceCategoryRepositoryAdapter(
      repo as never,
      { toDomain: jest.fn() } as never
    );

    await expect(adapter.deleteCustom(COOP, 1)).resolves.toBe(false);
  });
});
