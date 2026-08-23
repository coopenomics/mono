/**
 * Unit-тесты личного избранного Благороста.
 *
 * Что здесь защищается. Избранное — строго личные данные: резолвер обязан
 * отклонять запросы за чужого пользователя независимо от роли. Добавление
 * идёт только на существующую цель (мусор от удалённых сущностей не копится),
 * повторное добавление идемпотентно, а выдача отфильтровывает записи,
 * чьи цели уже удалены (это делает репозиторий join'ом).
 *
 * Реестр случаев: test-registry/capital.favorites.yaml
 */

import { BadRequestException } from '@nestjs/common';
import { FavoritesService } from '~/extensions/capital/application/services/favorites.service';
import { FavoritesResolver } from '~/extensions/capital/application/resolvers/favorites.resolver';
import { FavoriteTargetType } from '~/extensions/capital/domain/enums/favorite-target-type.enum';
import type { FavoriteRepository } from '~/extensions/capital/domain/repositories/favorite.repository';
import { FavoriteTypeormRepository } from '~/extensions/capital/infrastructure/repositories/favorite.typeorm-repository';

const CREATED_AT = new Date('2026-08-18T00:00:00Z');

function makeRepository(overrides: Partial<FavoriteRepository> = {}): FavoriteRepository {
  return {
    add: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined),
    findByUserWithTargets: jest.fn().mockResolvedValue([]),
    targetExists: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
}

const input = {
  coopname: 'voskhod',
  username: 'ant',
  target_type: FavoriteTargetType.PROJECT,
  target_hash: 'abc123',
};

describe('FavoritesService', () => {
  it('добавляет существующую цель и возвращает обновлённый список', async () => {
    const repo = makeRepository({
      findByUserWithTargets: jest.fn().mockResolvedValue([
        { ...input, title: 'Проект 1', parent_hash: null, created_at: CREATED_AT },
      ]),
    });
    const service = new FavoritesService(repo);

    const result = await service.addFavorite(input);

    expect(repo.add).toHaveBeenCalledWith(input);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Проект 1');
  });

  it('отклоняет добавление несуществующей цели и ничего не пишет', async () => {
    const repo = makeRepository({ targetExists: jest.fn().mockResolvedValue(false) });
    const service = new FavoritesService(repo);

    await expect(service.addFavorite(input)).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.add).not.toHaveBeenCalled();
  });

  it('удаление не проверяет существование цели — снять звёздочку можно всегда', async () => {
    const repo = makeRepository({ targetExists: jest.fn().mockResolvedValue(false) });
    const service = new FavoritesService(repo);

    await expect(service.removeFavorite(input)).resolves.toEqual([]);
    expect(repo.remove).toHaveBeenCalledWith(input);
  });
});

describe('FavoriteTypeormRepository — выдача с живыми целями', () => {
  it('запись с удалённой целью выпадает из выдачи, живая — с актуальным title и родителем', async () => {
    const favoritesRepo = {
      find: jest.fn().mockResolvedValue([
        {
          coopname: 'voskhod',
          username: 'ant',
          target_type: FavoriteTargetType.PROJECT,
          target_hash: 'live00',
          created_at: CREATED_AT,
        },
        {
          coopname: 'voskhod',
          username: 'ant',
          target_type: FavoriteTargetType.ISSUE,
          target_hash: 'gone00',
          created_at: CREATED_AT,
        },
      ]),
    };
    const projectRepo = {
      find: jest.fn().mockResolvedValue([
        { project_hash: 'live00', parent_hash: null, title: 'Живой проект' },
      ]),
    };
    // Задача 'gone00' удалена — таблица задач её не возвращает
    const issueRepo = { find: jest.fn().mockResolvedValue([]) };
    const storyRepo = { find: jest.fn().mockResolvedValue([]) };

    const repository = new FavoriteTypeormRepository(
      favoritesRepo as never,
      projectRepo as never,
      issueRepo as never,
      storyRepo as never
    );

    const result = await repository.findByUserWithTargets('voskhod', 'ant');

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ target_hash: 'live00', title: 'Живой проект' });
  });
});

describe('FavoritesResolver — только своё избранное', () => {
  const user = { username: 'ant', role: 'user' } as never;
  const chairman = { username: 'chairman', role: 'chairman' } as never;

  function makeResolver() {
    const service = {
      addFavorite: jest.fn().mockResolvedValue([]),
      removeFavorite: jest.fn().mockResolvedValue([]),
      getFavorites: jest.fn().mockResolvedValue([]),
    };
    return { resolver: new FavoritesResolver(service as never), service };
  }

  it('владелец читает и правит своё', async () => {
    const { resolver, service } = makeResolver();
    await resolver.getCapitalFavorites({ coopname: 'voskhod', username: 'ant' }, user);
    await resolver.addFavorite(input, user);
    await resolver.removeFavorite(input, user);
    expect(service.getFavorites).toHaveBeenCalled();
    expect(service.addFavorite).toHaveBeenCalled();
    expect(service.removeFavorite).toHaveBeenCalled();
  });

  it('чужое избранное закрыто даже для председателя', async () => {
    const { resolver, service } = makeResolver();
    await expect(
      resolver.getCapitalFavorites({ coopname: 'voskhod', username: 'ant' }, chairman)
    ).rejects.toThrow('Избранное доступно только своему владельцу');
    await expect(resolver.addFavorite(input, chairman)).rejects.toThrow();
    await expect(resolver.removeFavorite(input, chairman)).rejects.toThrow();
    expect(service.getFavorites).not.toHaveBeenCalled();
    expect(service.addFavorite).not.toHaveBeenCalled();
    expect(service.removeFavorite).not.toHaveBeenCalled();
  });
});
