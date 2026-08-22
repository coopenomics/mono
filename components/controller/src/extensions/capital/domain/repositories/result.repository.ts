import { IBlockchainSyncRepository } from '@coopenomics/extension-kit/sync';
import { ResultDomainEntity } from '../entities/result.entity';
import type { ResultFilterInputDTO } from '../../application/dto/result_submission/result-filter.input';
import type { PaginationInputDTO, PaginationResult } from '@coopenomics/extension-kit';

export interface ResultRepository extends IBlockchainSyncRepository<ResultDomainEntity> {
  create(result: Omit<ResultDomainEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<ResultDomainEntity>;
  findById(_id: string): Promise<ResultDomainEntity | null>;
  findByResultHash(resultHash: string): Promise<ResultDomainEntity | null>;
  findByProjectHashAndUsername(projectHash: string, username: string): Promise<ResultDomainEntity | null>;
  findAll(): Promise<ResultDomainEntity[]>;
  findByUsername(username: string): Promise<ResultDomainEntity[]>;
  findByProjectHash(projectHash: string): Promise<ResultDomainEntity[]>;
  findByStatus(status: string): Promise<ResultDomainEntity[]>;
  findAllPaginated(
    filter?: ResultFilterInputDTO,
    options?: PaginationInputDTO
  ): Promise<PaginationResult<ResultDomainEntity>>;
  update(entity: ResultDomainEntity): Promise<ResultDomainEntity>;
  delete(_id: string): Promise<void>;
}

export const RESULT_REPOSITORY = Symbol('ResultRepository');
