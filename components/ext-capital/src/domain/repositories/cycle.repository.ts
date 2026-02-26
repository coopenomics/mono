import { CycleDomainEntity } from '../entities/cycle.entity';
import type { CycleStatus } from '../enums/cycle-status.enum';
import type {
  PaginationInputDomainInterface,
  PaginationResultDomainInterface,
} from '~/domain/common/interfaces/pagination.interface';
import type { CycleFilterInputDTO } from '../../application/dto/generation/cycle-filter.input';

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
    options?: PaginationInputDomainInterface
  ): Promise<PaginationResultDomainInterface<CycleDomainEntity>>;
  update(entity: CycleDomainEntity): Promise<CycleDomainEntity>;
  delete(_id: string): Promise<void>;
}

export const CYCLE_REPOSITORY = Symbol('CycleRepository');
