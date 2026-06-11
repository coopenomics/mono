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

/**
 * Приватные данные собрания — хранятся только в БД платформы,
 * в блокчейн не публикуются (видны только пайщикам кооператива).
 */
export interface KuDecisionPrivateDataDomainInterface {
  hash: string;
  coopname?: string;
  type?: string;
  initiator?: string;
  meet_place?: string;
  meet_at?: Date;
  branch_name?: string;
}

export interface KuDecisionRepository extends IBlockchainSyncRepository<KuDecisionDomainEntity> {
  findByHash(hash: string): Promise<KuDecisionDomainEntity | null>;
  findAllPaginated(
    filter?: KuDecisionFilterDomainInterface,
    options?: PaginationInputDomainInterface
  ): Promise<PaginationResultDomainInterface<KuDecisionDomainEntity>>;
  /**
   * Записать приватные данные собрания (upsert по hash): запись могла ещё
   * не появиться из синка — тогда создаётся placeholder, который синк дополнит.
   */
  upsertPrivateData(data: KuDecisionPrivateDataDomainInterface): Promise<void>;
}

export const KU_DECISION_REPOSITORY = Symbol('KuDecisionRepository');
