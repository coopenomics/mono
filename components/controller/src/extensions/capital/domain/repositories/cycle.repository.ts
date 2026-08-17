import { CycleDomainEntity } from '../entities/cycle.entity';
import type { CycleStatus } from '../enums/cycle-status.enum';
import type { CycleFilterInputDTO } from '../../application/dto/generation/cycle-filter.input';
import type { PaginationInputDTO, PaginationResult } from '@coopenomics/extension-kit';

export interface CycleRepository {
  create(cycle: CycleDomainEntity): Promise<CycleDomainEntity>;
  findById(_id: string): Promise<CycleDomainEntity | null>;
  findAll(): Promise<CycleDomainEntity[]>;
  findByStatus(status: CycleStatus): Promise<CycleDomainEntity[]>;
  findActiveCycles(): Promise<CycleDomainEntity[]>;
  findByIdWithIssues(cycleId: string): Promise<CycleDomainEntity | null>;
  findActiveCycleWithIssues(): Promise<CycleDomainEntity | null>;
  findAllPaginated(
    filter?: CycleFilterInputDTO,
    options?: PaginationInputDTO
  ): Promise<PaginationResult<CycleDomainEntity>>;
  update(entity: CycleDomainEntity): Promise<CycleDomainEntity>;
  delete(_id: string): Promise<void>;
}

export const CYCLE_REPOSITORY = Symbol('CycleRepository');
