import type { IBlockchainSyncRepository } from '@coopenomics/extension-kit/sync';
import type { KuTrustRequestDomainEntity } from '../entities/ku-trust-request.entity';
import type { PaginationInputDTO, PaginationResult } from '@coopenomics/extension-kit';

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
    options?: PaginationInputDTO
  ): Promise<PaginationResult<KuTrustRequestDomainEntity>>;
}

export const KU_TRUST_REQUEST_REPOSITORY = Symbol('KuTrustRequestRepository');
