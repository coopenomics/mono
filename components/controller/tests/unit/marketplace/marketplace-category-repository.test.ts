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
 * Дубликат названия категории. Уникальность **глобальная** (решение заказчика
 * 2026-08-10): название занято, если оно есть где угодно в справочнике —
 * у базовых категорий платформы, у самого кооператива или у соседнего.
 *
 * Сервис спрашивает про занятость название целиком, а не читает свой список:
 * чужие кастомные категории в `listForCoop` не попадают, и на старой проверке
 * глобальное правило было недостижимо.
 */
describe('MarketplaceCategoryService.createCustom: дубликат названия', () => {
  function makeService(taken: boolean) {
    const repo = {
      listForCoop: jest.fn().mockResolvedValue([]),
      existsByDisplayName: jest.fn().mockResolvedValue(taken),
      createCustom: jest.fn().mockResolvedValue({ id: 42, display_name: 'Мёд' }),
    };
    return { service: new MarketplaceCategoryService(repo as never), repo };
  }

  it('название занято где-то в справочнике → отказ, создания нет', async () => {
    const { service, repo } = makeService(true);

    await expect(service.createCustom(COOP, 'Мёд')).rejects.toThrow(
      'Категория с таким названием уже существует'
    );
    expect(repo.createCustom).not.toHaveBeenCalled();
  });

  it('занятость проверяется по всему справочнику, а не по списку кооператива', async () => {
    const { service, repo } = makeService(false);

    await service.createCustom(COOP, 'Мёд');

    expect(repo.existsByDisplayName).toHaveBeenCalledWith('Мёд');
    expect(repo.listForCoop).not.toHaveBeenCalled();
  });

  it('пустое имя (одни пробелы) → отказ до обращения к справочнику', async () => {
    const { service, repo } = makeService(false);

    await expect(service.createCustom(COOP, '   ')).rejects.toThrow(
      'Название категории не может быть пустым'
    );
    expect(repo.existsByDisplayName).not.toHaveBeenCalled();
  });

  it('свободное имя создаётся — обрезанным', async () => {
    const { service, repo } = makeService(false);

    await service.createCustom(COOP, '  Мёд  ');

    expect(repo.createCustom).toHaveBeenCalledWith(COOP, 'Мёд');
  });
});

/**
 * Гонка двух одновременных запросов с одним названием (`mkt.cat.side.08`).
 *
 * Проверка в сервисе гонку не закрывает: оба запроса читают справочник до того,
 * как хоть один вставил строку, и оба видят имя свободным. Ловит дубль
 * уникальный индекс в базе — проигравшая вставка падает, и адаптер обязан
 * превратить это в тот же отказ, а не в внутреннюю ошибку.
 *
 * Отдельно — гонка за номер: идентификатор считается как MAX(id)+1, поэтому две
 * вставки разных названий претендуют на один номер. Это не конфликт имён,
 * повторная попытка обязана пройти.
 */
describe('MarketplaceCategoryRepositoryAdapter.createCustom: гонка', () => {
  const uniqueViolation = (constraint: string) =>
    Object.assign(new Error('duplicate key value violates unique constraint'), {
      driverError: { code: '23505', constraint },
    });

  function makeAdapter(saveImpl: jest.Mock) {
    const repo = {
      createQueryBuilder: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ maxId: 12, maxSort: 12 }),
      }),
      create: jest.fn((row) => row),
      save: saveImpl,
    };
    const mapper = { toDomain: jest.fn((r) => r) };
    return {
      adapter: new MarketplaceCategoryRepositoryAdapter(repo as never, mapper as never),
      repo,
    };
  }

  it('индекс отбил дубль названия → тот же отказ, что и на проверке', async () => {
    const save = jest
      .fn()
      .mockRejectedValue(uniqueViolation('ux_marketplace_category_display_name_lower'));
    const { adapter } = makeAdapter(save);

    await expect(adapter.createCustom(COOP, 'Мёд')).rejects.toThrow(
      'Категория с таким названием уже существует'
    );
    // Конфликт имени повторять бессмысленно — имя занято навсегда.
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('проигранная гонка за номер → номер пересчитывается, категория создаётся', async () => {
    const save = jest
      .fn()
      .mockRejectedValueOnce(uniqueViolation('marketplace_category_pkey'))
      .mockResolvedValueOnce({ id: 14, display_name: 'Мёд' });
    const { adapter } = makeAdapter(save);

    await expect(adapter.createCustom(COOP, 'Мёд')).resolves.toEqual({
      id: 14,
      display_name: 'Мёд',
    });
    expect(save).toHaveBeenCalledTimes(2);
  });

  it('ошибка не про уникальность наверх идёт как есть', async () => {
    const save = jest.fn().mockRejectedValue(new Error('соединение с базой потеряно'));
    const { adapter } = makeAdapter(save);

    await expect(adapter.createCustom(COOP, 'Мёд')).rejects.toThrow(
      'соединение с базой потеряно'
    );
    expect(save).toHaveBeenCalledTimes(1);
  });
});

/**
 * Область поиска занятого названия. Условие обязано совпадать с выражением
 * уникального индекса: индекс построен по `lower(display_name)` без фильтра по
 * кооперативу, и любое сужение здесь вернуло бы «свободно» там, где база
 * откажет.
 */
describe('MarketplaceCategoryRepositoryAdapter.existsByDisplayName', () => {
  function makeAdapter(count: number) {
    const qb = {
      where: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(count),
    };
    const repo = { createQueryBuilder: jest.fn().mockReturnValue(qb) };
    return {
      adapter: new MarketplaceCategoryRepositoryAdapter(
        repo as never,
        { toDomain: jest.fn() } as never
      ),
      qb,
    };
  }

  it('сравнивает без учёта регистра и без фильтра по кооперативу', async () => {
    const { adapter, qb } = makeAdapter(1);

    await expect(adapter.existsByDisplayName('Мёд')).resolves.toBe(true);
    expect(qb.where).toHaveBeenCalledWith('lower(c.display_name) = lower(:name)', {
      name: 'Мёд',
    });
    expect(qb.where).toHaveBeenCalledTimes(1);
  });

  it('совпадений нет → название свободно', async () => {
    const { adapter } = makeAdapter(0);

    await expect(adapter.existsByDisplayName('Мёд')).resolves.toBe(false);
  });
});
