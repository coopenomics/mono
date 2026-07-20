import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { IBlockchainSyncRepository } from '~/shared/interfaces/blockchain-sync.interface';
import { BaseBlockchainRepository } from '~/shared/sync/repositories/base-blockchain.repository';
import { EntityVersioningService } from '~/shared/sync/services/entity-versioning.service';
import type { KuDecisionQuestionRepository } from '../../domain/repositories/ku-decision-question.repository';
import { KuDecisionQuestionDomainEntity } from '../../domain/entities/ku-decision-question.entity';
import { KuDecisionQuestionTypeormEntity } from '../entities/ku-decision-question.typeorm-entity';
import { KuDecisionQuestionMapper } from '../mappers/ku-decision-question.mapper';
import type {
  IKuDecisionQuestionBlockchainData,
  IKuDecisionQuestionDatabaseData,
} from '../../domain/interfaces/ku-blockchain-data.interface';

@Injectable()
export class KuDecisionQuestionTypeormRepository
  extends BaseBlockchainRepository<KuDecisionQuestionDomainEntity, KuDecisionQuestionTypeormEntity>
  implements KuDecisionQuestionRepository, IBlockchainSyncRepository<KuDecisionQuestionDomainEntity>
{
  constructor(
    @InjectRepository(KuDecisionQuestionTypeormEntity)
    repository: Repository<KuDecisionQuestionTypeormEntity>,
    entityVersioningService: EntityVersioningService
  ) {
    super(repository, entityVersioningService);
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
    const entities = await this.repository.find({
      where: { coopname, decision_id: decisionId },
      order: { number: 'ASC' },
    });
    return entities.map((entity) => KuDecisionQuestionMapper.toDomain(entity));
  }

  async update(entity: KuDecisionQuestionDomainEntity): Promise<KuDecisionQuestionDomainEntity> {
    const updateData = KuDecisionQuestionMapper.toUpdateEntity(entity);
    await this.repository.update(entity._id, updateData);

    const updatedEntity = await this.repository.findOne({ where: { _id: entity._id } });
    if (!updatedEntity) {
      throw new Error(`Вопрос повестки ${entity.id} не найден после обновления`);
    }

    return KuDecisionQuestionMapper.toDomain(updatedEntity);
  }
}
