import type { ApprovalDomainEntity } from '../entities/approval.entity';
import type { IBlockchainSyncRepository } from '@coopenomics/extension-kit/sync';
import type { ApprovalFilterInput } from '../../application/dto/approval-filter.input';
import type { PaginationInputDTO, PaginationResult } from '@coopenomics/extension-kit';

export const APPROVAL_REPOSITORY = Symbol('APPROVAL_REPOSITORY');

/**
 * Интерфейс репозитория одобрений
 */
export interface ApprovalRepository extends IBlockchainSyncRepository<ApprovalDomainEntity> {
  // Стандартные CRUD методы
  findAll(): Promise<ApprovalDomainEntity[]>;
  findById(_id: string): Promise<ApprovalDomainEntity | null>;
  save(entity: ApprovalDomainEntity): Promise<ApprovalDomainEntity>;

  // Пагинированный поиск с фильтрами
  findAllPaginated(
    filter?: ApprovalFilterInput,
    options?: PaginationInputDTO
  ): Promise<PaginationResult<ApprovalDomainEntity>>;

  // Дополнительные методы репозитория одобрений
  findByCoopname(coopname: string): Promise<ApprovalDomainEntity[]>;
  findByUsername(username: string): Promise<ApprovalDomainEntity[]>;
  findByApprovalHash(approvalHash: string): Promise<ApprovalDomainEntity | null>;
}
