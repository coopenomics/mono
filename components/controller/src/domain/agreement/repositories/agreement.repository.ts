import type { AgreementDomainEntity } from '../entities/agreement.entity';
import type { IBlockchainSyncRepository } from '@coopenomics/extension-kit/sync';
import type {
  PaginationInputDomainInterface,
  PaginationResultDomainInterface,
} from '~/domain/common/interfaces/pagination.interface';

export const AGREEMENT_REPOSITORY = Symbol('AGREEMENT_REPOSITORY');

/**
 * Фильтр для поиска соглашений
 */
export interface AgreementFilterInput {
  coopname?: string;
  username?: string;
  type?: string;
  program_id?: number;
  statuses?: string[];
  created_from?: Date;
  created_to?: Date;
}

/**
 * Интерфейс репозитория соглашений
 */
export interface AgreementRepository extends IBlockchainSyncRepository<AgreementDomainEntity> {
  // Пагинированный поиск с фильтрами
  findAllPaginated(
    filter?: AgreementFilterInput,
    options?: PaginationInputDomainInterface
  ): Promise<PaginationResultDomainInterface<AgreementDomainEntity>>;

  // Дополнительные методы репозитория соглашений
  findByCoopname(coopname: string): Promise<AgreementDomainEntity[]>;
  findByUsername(username: string): Promise<AgreementDomainEntity[]>;
  findByType(type: string): Promise<AgreementDomainEntity[]>;
  findByProgramId(program_id: number): Promise<AgreementDomainEntity[]>;
}
