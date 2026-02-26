import { Injectable } from '@nestjs/common';
import { CommitDomainEntity } from '../../domain/entities/commit.entity';
import { CommitOutputDTO, CommitAmountsOutputDTO } from '../dto/generation/commit.dto';
import { BaseProjectOutputDTO } from '../dto/project_management/project.dto';
import { ProjectRepository, PROJECT_REPOSITORY } from '../../domain/repositories/project.repository';
import { ProjectMapperService } from './project-mapper.service';
import { Inject } from '@nestjs/common';
import type { MonoAccountDomainInterface } from '~/domain/account/interfaces/mono-account-domain.interface';

/**
 * Сервис для маппинга доменных сущностей коммитов в DTO
 * Централизует логику преобразования и обогащения коммитов данными о проекте и amounts
 */
@Injectable()
export class CommitMapperService {
  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly projectRepository: ProjectRepository,
    private readonly projectMapperService: ProjectMapperService
  ) {}

  /**
   * Преобразование доменной сущности коммита в CommitOutputDTO
   * Обогащает коммит данными о проекте и amounts
   */
  async toDTO(commitEntity: CommitDomainEntity, currentUser?: MonoAccountDomainInterface): Promise<CommitOutputDTO> {
    // Получаем проект, если есть project_hash
    let project: BaseProjectOutputDTO | undefined;
    if (commitEntity.project_hash) {
      const projectEntity = await this.projectRepository.findByHash(commitEntity.project_hash);
      if (projectEntity) {
        // Маппим проект с permissions через projectMapperService
        const projectsWithPermissions = await this.projectMapperService.mapBatchToBaseDTO([projectEntity], currentUser);
        project = projectsWithPermissions[0];
      }
    }

    // Маппим amounts
    const amounts = commitEntity.amounts ? this.mapAmountsToDTO(commitEntity.amounts) : undefined;

    // Возвращаем обогащенный коммит
    return {
      ...commitEntity,
      project,
      amounts,
    } as CommitOutputDTO;
  }

  /**
   * Пакетное преобразование массива доменных сущностей коммитов в массив CommitOutputDTO
   * Оптимизировано для работы с большим количеством коммитов
   */
  async toDTOBatch(
    commitEntities: CommitDomainEntity[],
    currentUser?: MonoAccountDomainInterface
  ): Promise<CommitOutputDTO[]> {
    // Получаем уникальные project_hash из коммитов
    const projectHashes: string[] = commitEntities
      .map((commit) => commit.project_hash)
      .filter((hash): hash is string => hash !== null && hash !== undefined);

    // Получаем проекты для обогащения данных
    const projects = projectHashes.length > 0 ? await this.projectRepository.findByHashes(projectHashes) : [];

    // Маппим проекты в BaseProjectOutputDTO с permissions
    const projectsWithPermissions = await this.projectMapperService.mapBatchToBaseDTO(projects, currentUser);

    // Создаем карту проектов для быстрого доступа
    const projectsMap = new Map(projectsWithPermissions.map((project) => [project.project_hash, project]));

    // Обогащаем коммиты информацией о проекте и amounts
    return commitEntities.map((commit) => {
      const project = commit.project_hash ? projectsMap.get(commit.project_hash) : undefined;
      const amounts = commit.amounts ? this.mapAmountsToDTO(commit.amounts) : undefined;
      return {
        ...commit,
        project,
        amounts,
      } as CommitOutputDTO;
    });
  }

  /**
   * Маппинг объекта amounts из доменной сущности в DTO
   */
  private mapAmountsToDTO(amounts: any): CommitAmountsOutputDTO {
    return {
      hour_cost: amounts.hour_cost?.toString(),
      creators_hours: amounts.creators_hours?.toString(),
      creators_base_pool: amounts.creators_base_pool?.toString(),
      authors_base_pool: amounts.authors_base_pool?.toString(),
      creators_bonus_pool: amounts.creators_bonus_pool?.toString(),
      authors_bonus_pool: amounts.authors_bonus_pool?.toString(),
      total_generation_pool: amounts.total_generation_pool?.toString(),
      contributors_bonus_pool: amounts.contributors_bonus_pool?.toString(),
      total_contribution: amounts.total_contribution?.toString(),
    };
  }
}
