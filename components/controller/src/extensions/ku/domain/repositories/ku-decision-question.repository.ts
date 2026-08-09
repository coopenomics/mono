import type { IBlockchainSyncRepository } from '~/shared/interfaces/blockchain-sync.interface';
import type { KuDecisionQuestionDomainEntity } from '../entities/ku-decision-question.entity';

export interface KuDecisionQuestionRepository extends IBlockchainSyncRepository<KuDecisionQuestionDomainEntity> {
  findByDecisionId(coopname: string, decisionId: number): Promise<KuDecisionQuestionDomainEntity[]>;
}

export const KU_DECISION_QUESTION_REPOSITORY = Symbol('KuDecisionQuestionRepository');
