import { IBlockchainSyncRepository } from '@coopenomics/extension-kit/sync';
import type { PaginationInputDTO, PaginationResult } from '@coopenomics/extension-kit';
import { ProgramPropertyDomainEntity } from '../entities/program-property.entity';
import type { ProgramPropertyFilterInputDTO } from '../../application/dto/property_management/program-property-filter.input';

export interface ProgramPropertyRepository extends IBlockchainSyncRepository<ProgramPropertyDomainEntity> {
  /** Паевые взносы имуществом с отбором по пайщику и статусу — постранично, новые первыми. */
  findAllPaginated(
    filter?: ProgramPropertyFilterInputDTO,
    options?: PaginationInputDTO
  ): Promise<PaginationResult<ProgramPropertyDomainEntity>>;
  /**
   * Взнос по ключу шага процесса: хэш взноса (повестка совета), хэш заявления
   * (одобрение заявления) или хэш акта (одобрение акта). Одобрения председателя
   * заводятся под хэшем одобряемого документа.
   */
  findByStepHash(hash: string): Promise<ProgramPropertyDomainEntity | null>;
}

export const PROGRAM_PROPERTY_REPOSITORY = Symbol('ProgramPropertyRepository');
