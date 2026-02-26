import { IBlockchainSyncRepository } from '~/shared/interfaces/blockchain-sync.interface';
import { ProjectDomainEntity } from '../entities/project.entity';
import type {
  PaginationInputDomainInterface,
  PaginationResultDomainInterface,
} from '~/domain/common/interfaces/pagination.interface';
import type { ProjectFilterInputDTO } from '../../application/dto/property_management/project-filter.input';

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
    options?: PaginationInputDomainInterface
  ): Promise<PaginationResultDomainInterface<ProjectDomainEntity>>;
  findAllPaginatedWithComponents(
    filter?: ProjectFilterInputDTO,
    options?: PaginationInputDomainInterface
  ): Promise<PaginationResultDomainInterface<ProjectDomainEntity>>;
  findByHashWithComponents(hash: string): Promise<ProjectDomainEntity | null>;
  findComponentsByParentHash(parentHash: string): Promise<ProjectDomainEntity[]>;
  update(entity: ProjectDomainEntity): Promise<ProjectDomainEntity>;
  delete(_id: string): Promise<void>;
}

export const PROJECT_REPOSITORY = Symbol('ProjectRepository');
