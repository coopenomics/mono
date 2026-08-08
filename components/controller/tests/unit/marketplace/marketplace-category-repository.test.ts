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
import { MarketplaceCategoryService } from '~/extensions/marketplace/application/services/marketplace-category.service';

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

/**
 * Дубликат названия в пределах кооператива.
 *
 * Область сравнения — то, что кооператив видит: базовые категории платформы
 * плюс его собственные. Чужие категории других кооперативов в сравнение не
 * попадают — вопрос о глобальной уникальности открыт (mkt.cat.side.07),
 * поэтому здесь проверяется ровно определённая часть правила.
 */
describe('MarketplaceCategoryService.createCustom: дубликат названия', () => {
  function makeService(visible: Array<{ display_name: string }>) {
    const repo = {
      listForCoop: jest.fn().mockResolvedValue(visible),
      createCustom: jest.fn().mockResolvedValue({ id: 42, display_name: 'Мёд' }),
    };
    return { service: new MarketplaceCategoryService(repo as never), repo };
  }

  it('совпадение с собственной категорией кооператива → отказ, создания нет', async () => {
    const { service, repo } = makeService([{ display_name: 'Мёд' }]);

    await expect(service.createCustom(COOP, 'Мёд')).rejects.toThrow(
      'Категория с таким названием уже существует'
    );
    expect(repo.createCustom).not.toHaveBeenCalled();
  });

  it('совпадение с базовой категорией платформы → тоже отказ', async () => {
    // listForCoop отдаёт базовые вместе с собственными, поэтому занять имя
    // «Овощи и фрукты» кооператив не может.
    const { service, repo } = makeService([{ display_name: 'Овощи и фрукты' }]);

    await expect(service.createCustom(COOP, 'Овощи и фрукты')).rejects.toThrow(
      'Категория с таким названием уже существует'
    );
    expect(repo.createCustom).not.toHaveBeenCalled();
  });

  it('различие только в регистре — тот же дубликат', async () => {
    const { service, repo } = makeService([{ display_name: 'Мёд' }]);

    await expect(service.createCustom(COOP, 'МЁД')).rejects.toThrow(
      'Категория с таким названием уже существует'
    );
    expect(repo.createCustom).not.toHaveBeenCalled();
  });

  it('пробелы по краям обрезаются до сравнения — тоже дубликат', async () => {
    const { service, repo } = makeService([{ display_name: 'Мёд' }]);

    await expect(service.createCustom(COOP, '  Мёд  ')).rejects.toThrow(
      'Категория с таким названием уже существует'
    );
    expect(repo.createCustom).not.toHaveBeenCalled();
  });

  it('пустое имя (одни пробелы) → отказ до чтения списка', async () => {
    const { service, repo } = makeService([]);

    await expect(service.createCustom(COOP, '   ')).rejects.toThrow(
      'Название категории не может быть пустым'
    );
    expect(repo.listForCoop).not.toHaveBeenCalled();
  });

  it('свободное имя создаётся — обрезанным', async () => {
    const { service, repo } = makeService([{ display_name: 'Овощи и фрукты' }]);

    await service.createCustom(COOP, '  Мёд  ');

    expect(repo.createCustom).toHaveBeenCalledWith(COOP, 'Мёд');
  });
});
