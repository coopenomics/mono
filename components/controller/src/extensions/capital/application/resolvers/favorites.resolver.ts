import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { AuthRoles, CurrentUser, GqlJwtAuthGuard, RolesGuard } from '@coopenomics/extension-kit';
import type { IMonoAccount } from '@coopenomics/innercoop';
import { FavoritesService } from '../services/favorites.service';
import {
  CapitalFavoriteInputDTO,
  CapitalFavoriteOutputDTO,
  CapitalFavoritesFilterInputDTO,
} from '../dto/favorites';

/**
 * Личное избранное пайщика: проекты, компоненты, задачи, артефакты.
 * Мутации возвращают обновлённый список целиком — клиент синхронизируется одним ответом.
 */
@Resolver()
export class FavoritesResolver {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Query(() => [CapitalFavoriteOutputDTO], {
    name: 'capitalFavorites',
    description: 'Список избранного пользователя с актуальными наименованиями',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async getCapitalFavorites(
    @Args('filter') filter: CapitalFavoritesFilterInputDTO,
    @CurrentUser() currentUser: IMonoAccount
  ): Promise<CapitalFavoriteOutputDTO[]> {
    this.assertSelf(filter.username, currentUser);
    return this.favoritesService.getFavorites(filter);
  }

  @Mutation(() => [CapitalFavoriteOutputDTO], {
    name: 'capitalAddFavorite',
    description: 'Добавить сущность в личное избранное',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async addFavorite(
    @Args('data') data: CapitalFavoriteInputDTO,
    @CurrentUser() currentUser: IMonoAccount
  ): Promise<CapitalFavoriteOutputDTO[]> {
    this.assertSelf(data.username, currentUser);
    return this.favoritesService.addFavorite(data);
  }

  @Mutation(() => [CapitalFavoriteOutputDTO], {
    name: 'capitalRemoveFavorite',
    description: 'Убрать сущность из личного избранного',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async removeFavorite(
    @Args('data') data: CapitalFavoriteInputDTO,
    @CurrentUser() currentUser: IMonoAccount
  ): Promise<CapitalFavoriteOutputDTO[]> {
    this.assertSelf(data.username, currentUser);
    return this.favoritesService.removeFavorite(data);
  }

  // Избранное строго личное: даже председатель не читает и не правит чужое
  private assertSelf(username: string, currentUser: IMonoAccount): void {
    if (username !== currentUser.username) {
      throw new Error('Избранное доступно только своему владельцу');
    }
  }
}
