import type { IBlockchainSyncRepository } from '@coopenomics/extension-kit/sync';
import type { KuDecisionQuestionDomainEntity } from '../entities/ku-decision-question.entity';

export interface KuDecisionQuestionRepository extends IBlockchainSyncRepository<KuDecisionQuestionDomainEntity> {
  findByDecisionId(coopname: string, decisionId: number): Promise<KuDecisionQuestionDomainEntity[]>;
}

export const KU_DECISION_QUESTION_REPOSITORY = Symbol('KuDecisionQuestionRepository');
