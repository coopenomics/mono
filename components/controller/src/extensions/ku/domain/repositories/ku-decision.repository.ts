import type { IBlockchainSyncRepository } from '~/shared/interfaces/blockchain-sync.interface';
import type {
  PaginationInputDomainInterface,
  PaginationResultDomainInterface,
} from '~/domain/common/interfaces/pagination.interface';
import type { KuDecisionDomainEntity } from '../entities/ku-decision.entity';

export interface KuDecisionFilterDomainInterface {
  coopname?: string;
  type?: string;
  status?: string;
  braname?: string;
  initiator?: string;
  present?: boolean;
}

export interface KuDecisionRepository extends IBlockchainSyncRepository<KuDecisionDomainEntity> {
  findByHash(hash: string): Promise<KuDecisionDomainEntity | null>;
  findAllPaginated(
    filter?: KuDecisionFilterDomainInterface,
    options?: PaginationInputDomainInterface
  ): Promise<PaginationResultDomainInterface<KuDecisionDomainEntity>>;
}

export const KU_DECISION_REPOSITORY = Symbol('KuDecisionRepository');
