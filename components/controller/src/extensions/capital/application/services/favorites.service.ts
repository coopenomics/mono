import { Inject, Injectable } from '@nestjs/common';
import {
  FAVORITE_REPOSITORY,
  FavoriteRepository,
  IFavoriteWithTarget,
} from '../../domain/repositories/favorite.repository';
import {
  CapitalFavoriteInputDTO,
  CapitalFavoriteOutputDTO,
  CapitalFavoritesFilterInputDTO,
} from '../dto/favorites';
import { DomainError } from '@coopenomics/extension-kit';

@Injectable()
export class FavoritesService {
  constructor(
    @Inject(FAVORITE_REPOSITORY)
    private readonly favoriteRepository: FavoriteRepository
  ) {}

  async addFavorite(data: CapitalFavoriteInputDTO): Promise<CapitalFavoriteOutputDTO[]> {
    const exists = await this.favoriteRepository.targetExists(data.target_type, data.target_hash);
    if (!exists) {
      throw DomainError.badRequest('CAPITAL_FAVORITE_TARGET_NOT_FOUND');
    }
    await this.favoriteRepository.add(data);
    return this.getFavorites({ coopname: data.coopname, username: data.username });
  }

  async removeFavorite(data: CapitalFavoriteInputDTO): Promise<CapitalFavoriteOutputDTO[]> {
    await this.favoriteRepository.remove(data);
    return this.getFavorites({ coopname: data.coopname, username: data.username });
  }

  async getFavorites(filter: CapitalFavoritesFilterInputDTO): Promise<CapitalFavoriteOutputDTO[]> {
    const favorites = await this.favoriteRepository.findByUserWithTargets(
      filter.coopname,
      filter.username
    );
    return favorites.map(this.toDTO);
  }

  private toDTO(favorite: IFavoriteWithTarget): CapitalFavoriteOutputDTO {
    return {
      coopname: favorite.coopname,
      username: favorite.username,
      target_type: favorite.target_type,
      target_hash: favorite.target_hash,
      title: favorite.title,
      parent_hash: favorite.parent_hash,
      created_at: favorite.created_at,
    };
  }
}
