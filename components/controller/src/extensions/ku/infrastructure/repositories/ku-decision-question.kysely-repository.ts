import { KU_DECISION_QUESTION_STORE } from '../database/ku-stores';
import { type TableStore } from '@coopenomics/extension-kit';
import { Inject, Injectable } from '@nestjs/common';
import type { IBlockchainSyncRepository } from '@coopenomics/extension-kit/sync';
import { BaseChainRepository, ChainVersioningService } from '@coopenomics/extension-kit/sync';
import type { KuDecisionQuestionRepository } from '../../domain/repositories/ku-decision-question.repository';
import { KuDecisionQuestionDomainEntity } from '../../domain/entities/ku-decision-question.entity';
import { KuDecisionQuestionRecord } from '../entities/ku-decision-question.record';
import { KuDecisionQuestionMapper } from '../mappers/ku-decision-question.mapper';
import type {
  IKuDecisionQuestionBlockchainData,
  IKuDecisionQuestionDatabaseData,
} from '../../domain/interfaces/ku-blockchain-data.interface';

@Injectable()
export class KuDecisionQuestionKyselyRepository
  extends BaseChainRepository<KuDecisionQuestionDomainEntity, KuDecisionQuestionRecord>
  implements KuDecisionQuestionRepository, IBlockchainSyncRepository<KuDecisionQuestionDomainEntity>
{
  constructor(
    @Inject(KU_DECISION_QUESTION_STORE) repository: TableStore<KuDecisionQuestionRecord>,
    @Inject(ChainVersioningService) versioning: ChainVersioningService
  ) {
    super(repository, versioning);
  }

  protected getMapper() {
    return {
      toDomain: KuDecisionQuestionMapper.toDomain,
      toEntity: KuDecisionQuestionMapper.toEntity,
    };
  }

  protected createDomainEntity(
    databaseData: IKuDecisionQuestionDatabaseData,
    blockchainData: IKuDecisionQuestionBlockchainData
  ): KuDecisionQuestionDomainEntity {
    return new KuDecisionQuestionDomainEntity(databaseData, blockchainData);
  }

  protected getSyncKey(): string {
    return KuDecisionQuestionDomainEntity.getSyncKey();
  }

  async findByDecisionId(coopname: string, decisionId: number): Promise<KuDecisionQuestionDomainEntity[]> {
    const entities = await this.repository.find({ coopname, decision_id: decisionId }, { order: { number: 'ASC' } });
    return entities.map((entity) => KuDecisionQuestionMapper.toDomain(entity));
  }

  async update(entity: KuDecisionQuestionDomainEntity): Promise<KuDecisionQuestionDomainEntity> {
    const updateData = KuDecisionQuestionMapper.toUpdateEntity(entity);
    await this.repository.update({ _id: entity._id }, updateData);

    const updatedEntity = await this.repository.findOne({ _id: entity._id });
    if (!updatedEntity) {
      // i18n-ignore: внутренний инвариант согласованности после обновления записи в БД, до пайщика не доходит
      throw new Error(`Вопрос повестки ${entity.id} не найден после обновления`);
    }

    return KuDecisionQuestionMapper.toDomain(updatedEntity);
  }
}
