import { KuDecisionQuestionDomainEntity } from '../../domain/entities/ku-decision-question.entity';
import type { KuDecisionQuestionTypeormEntity } from '../entities/ku-decision-question.typeorm-entity';
import type {
  IKuDecisionQuestionBlockchainData,
  IKuDecisionQuestionDatabaseData,
} from '../../domain/interfaces/ku-blockchain-data.interface';

/**
 * Маппер между доменной сущностью вопроса повестки и TypeORM-сущностью
 */
export class KuDecisionQuestionMapper {
  static toDomain(entity: KuDecisionQuestionTypeormEntity): KuDecisionQuestionDomainEntity {
    const databaseData: IKuDecisionQuestionDatabaseData = {
      _id: entity._id,
      block_num: entity.block_num,
      present: entity.present,
      status: entity.status,
      _created_at: entity._created_at,
      _updated_at: entity._updated_at,
    };

    let blockchainData: IKuDecisionQuestionBlockchainData | undefined;

    if (entity.id !== null && entity.id !== undefined) {
      blockchainData = {
        id: entity.id,
        decision_id: entity.decision_id,
        number: entity.number,
        coopname: entity.coopname,
        title: entity.title,
        decision: entity.decision,
        context: entity.context,
        counter_votes_for: entity.counter_votes_for,
        counter_votes_against: entity.counter_votes_against,
        counter_votes_abstained: entity.counter_votes_abstained,
        voters_for: entity.voters_for ?? [],
        voters_against: entity.voters_against ?? [],
        voters_abstained: entity.voters_abstained ?? [],
      };
    }

    return new KuDecisionQuestionDomainEntity(databaseData, blockchainData);
  }

  static toEntity(domain: KuDecisionQuestionDomainEntity): Partial<KuDecisionQuestionTypeormEntity> {
    return {
      _id: domain._id,
      block_num: domain.block_num ?? 0,
      present: domain.present,
      status: domain.status as string,
      _created_at: domain._created_at,
      _updated_at: domain._updated_at,
      id: domain.id as number,
      decision_id: domain.decision_id as number,
      number: domain.number as number,
      coopname: domain.coopname as string,
      title: domain.title as string,
      decision: domain.decision as string,
      context: domain.context ?? '',
      counter_votes_for: domain.counter_votes_for ?? 0,
      counter_votes_against: domain.counter_votes_against ?? 0,
      counter_votes_abstained: domain.counter_votes_abstained ?? 0,
      voters_for: domain.voters_for ?? [],
      voters_against: domain.voters_against ?? [],
      voters_abstained: domain.voters_abstained ?? [],
    };
  }

  static toUpdateEntity(domain: Partial<KuDecisionQuestionDomainEntity>): Partial<KuDecisionQuestionTypeormEntity> {
    const updateData: Partial<KuDecisionQuestionTypeormEntity> = {};

    if (domain.block_num !== undefined) updateData.block_num = domain.block_num;
    if (domain.present !== undefined) updateData.present = domain.present;
    if (domain.counter_votes_for !== undefined) updateData.counter_votes_for = domain.counter_votes_for;
    if (domain.counter_votes_against !== undefined) updateData.counter_votes_against = domain.counter_votes_against;
    if (domain.counter_votes_abstained !== undefined) updateData.counter_votes_abstained = domain.counter_votes_abstained;
    if (domain.voters_for !== undefined) updateData.voters_for = domain.voters_for;
    if (domain.voters_against !== undefined) updateData.voters_against = domain.voters_against;
    if (domain.voters_abstained !== undefined) updateData.voters_abstained = domain.voters_abstained;

    return updateData;
  }
}
