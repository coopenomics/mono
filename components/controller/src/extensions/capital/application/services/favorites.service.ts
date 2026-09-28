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
import type { IMonoAccount } from '@coopenomics/innercoop';
import { PROJECT_REPOSITORY, ProjectRepository } from '../../domain/repositories/project.repository';
import { canViewLocalProject } from '../../domain/utils/private-project-access';
import { FavoriteTargetType } from '../../domain/enums/favorite-target-type.enum';
import { GenerationService } from './generation.service';

@Injectable()
export class FavoritesService {
  constructor(
    @Inject(FAVORITE_REPOSITORY)
    private readonly favoriteRepository: FavoriteRepository,
    @Inject(PROJECT_REPOSITORY)
    private readonly projectRepository: ProjectRepository,
    private readonly generationService: GenerationService
  ) {}

  async addFavorite(data: CapitalFavoriteInputDTO, currentUser: IMonoAccount): Promise<CapitalFavoriteOutputDTO[]> {
    const exists = await this.favoriteRepository.targetExists(data.target_type, data.target_hash);
    // Невидимая пайщику цель — то же «не найдено»: избранное отдаёт название
    // цели, и через него раньше читалось название чужого личного проекта
    // (до 25.09.2026). Видимость — те же правила, что в списках.
    if (!exists || !(await this.canView(data.target_type, data.target_hash, currentUser))) {
      throw DomainError.badRequest('CAPITAL_FAVORITE_TARGET_NOT_FOUND');
    }
    await this.favoriteRepository.add(data);
    return this.getFavorites({ coopname: data.coopname, username: data.username });
  }

  private async canView(type: FavoriteTargetType, hash: string, currentUser: IMonoAccount): Promise<boolean> {
    switch (type) {
      case FavoriteTargetType.PROJECT:
      case FavoriteTargetType.COMPONENT:
        return canViewLocalProject(await this.projectRepository.findByHash(hash.toLowerCase()), currentUser.username);
      case FavoriteTargetType.ISSUE:
        return (await this.generationService.getIssueByHash(hash, currentUser)) !== null;
      case FavoriteTargetType.ARTIFACT:
        return (await this.generationService.getStoryByHash(hash, currentUser)) !== null;
    }
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
