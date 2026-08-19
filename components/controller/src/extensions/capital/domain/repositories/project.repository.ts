import { IBlockchainSyncRepository } from '@coopenomics/extension-kit/sync';
import { ProjectDomainEntity } from '../entities/project.entity';
import type { ProjectPriority } from '../enums/project-priority.enum';
import type { ProjectFilterInputDTO } from '../../application/dto/property_management/project-filter.input';
import type { PaginationInputDTO, PaginationResult } from '@coopenomics/extension-kit';
import type { ArtifactAccessScope } from './artifact-access-scope';

export interface ProjectRepository extends IBlockchainSyncRepository<ProjectDomainEntity> {
  create(project: Omit<ProjectDomainEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProjectDomainEntity>;
  findById(_id: string): Promise<ProjectDomainEntity | null>;
  findByHash(hash: string): Promise<ProjectDomainEntity | null>;
  findByHashes(hashes: string[]): Promise<ProjectDomainEntity[]>;
  findAll(): Promise<ProjectDomainEntity[]>;
  findByMaster(master: string): Promise<ProjectDomainEntity[]>;
  findByStatus(status: string): Promise<ProjectDomainEntity[]>;
  findByIdWithIssues(projectHash: string): Promise<ProjectDomainEntity | null>;
  findByIdWithStories(projectHash: string): Promise<ProjectDomainEntity | null>;
  findByIdWithAllRelations(projectHash: string): Promise<ProjectDomainEntity | null>;
  findAllPaginated(
    filter?: ProjectFilterInputDTO,
    options?: PaginationInputDTO
  ): Promise<PaginationResult<ProjectDomainEntity>>;
  findAllPaginatedWithComponents(
    filter?: ProjectFilterInputDTO,
    options?: PaginationInputDTO,
    scope?: ArtifactAccessScope
  ): Promise<PaginationResult<ProjectDomainEntity>>;
  findByHashWithComponents(hash: string): Promise<ProjectDomainEntity | null>;
  findComponentsByParentHash(parentHash: string): Promise<ProjectDomainEntity[]>;
  update(entity: ProjectDomainEntity): Promise<ProjectDomainEntity>;
  delete(_id: string): Promise<void>;
  /** Обновить текстовые поля персонального (LOCAL) проекта без блокчейна. */
  updateLocalContent(
    projectHash: string,
    fields: {
      title?: string;
      description?: string;
      invite?: string;
      meta?: string;
      data?: string;
    }
  ): Promise<ProjectDomainEntity>;
  /** Мягкое удаление локального проекта (present=false). */
  softDeleteLocal(projectHash: string): Promise<void>;
  /** Локальное поле Matrix (не блокчейн) */
  setMatrixRoomId(projectHash: string, matrixRoomId: string): Promise<void>;
  /** URL репозитория разработки (только БД, PRD §6.2.1). */
  setDevelopmentRepositoryUrl(projectHash: string, url: string | null): Promise<void>;
  /** Приоритет проекта/компонента (только БД). */
  setPriority(projectHash: string, priority: ProjectPriority): Promise<void>;
  /** Уникальные непустые URL репозиториев проектов/компонентов кооператива для polling маркеров. */
  findDistinctDevelopmentRepositoryUrls(coopname: string): Promise<string[]>;
  /** Сколько проектов кооператива ссылаются на данный нормализованный URL репозитория. */
  countByCoopnameAndDevelopmentRepositoryUrl(coopname: string, normalizedRepositoryUrl: string): Promise<number>;
}

export const PROJECT_REPOSITORY = Symbol('ProjectRepository');
