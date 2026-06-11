import type { IBlockchainSyncRepository } from '~/shared/interfaces/blockchain-sync.interface';
import type {
  PaginationInputDomainInterface,
  PaginationResultDomainInterface,
} from '~/domain/common/interfaces/pagination.interface';
import type { KuTrustRequestDomainEntity } from '../entities/ku-trust-request.entity';

export interface KuTrustRequestFilterDomainInterface {
  coopname?: string;
  braname?: string;
  username?: string;
  present?: boolean;
}

export interface KuTrustRequestRepository extends IBlockchainSyncRepository<KuTrustRequestDomainEntity> {
  findByHash(hash: string): Promise<KuTrustRequestDomainEntity | null>;
  findAllPaginated(
    filter?: KuTrustRequestFilterDomainInterface,
    options?: PaginationInputDomainInterface
  ): Promise<PaginationResultDomainInterface<KuTrustRequestDomainEntity>>;
}

export const KU_TRUST_REQUEST_REPOSITORY = Symbol('KuTrustRequestRepository');
