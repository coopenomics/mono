import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { IBlockchainSyncRepository } from '~/shared/interfaces/blockchain-sync.interface';
import { BaseBlockchainRepository } from '~/shared/sync/repositories/base-blockchain.repository';
import { EntityVersioningService } from '~/shared/sync/services/entity-versioning.service';
import type {
  PaginationInputDomainInterface,
  PaginationResultDomainInterface,
} from '~/domain/common/interfaces/pagination.interface';
import { PaginationUtils } from '~/shared/utils/pagination.utils';
import type {
  KuDecisionFilterDomainInterface,
  KuDecisionRepository,
} from '../../domain/repositories/ku-decision.repository';
import { KuDecisionDomainEntity } from '../../domain/entities/ku-decision.entity';
import { KuDecisionTypeormEntity } from '../entities/ku-decision.typeorm-entity';
import { KuDecisionMapper } from '../mappers/ku-decision.mapper';
import type {
  IKuDecisionBlockchainData,
  IKuDecisionDatabaseData,
} from '../../domain/interfaces/ku-blockchain-data.interface';

@Injectable()
export class KuDecisionTypeormRepository
  extends BaseBlockchainRepository<KuDecisionDomainEntity, KuDecisionTypeormEntity>
  implements KuDecisionRepository, IBlockchainSyncRepository<KuDecisionDomainEntity>
{
  constructor(
    @InjectRepository(KuDecisionTypeormEntity)
    repository: Repository<KuDecisionTypeormEntity>,
    entityVersioningService: EntityVersioningService
  ) {
    super(repository, entityVersioningService);
  }

  protected getMapper() {
    return {
      toDomain: KuDecisionMapper.toDomain,
      toEntity: KuDecisionMapper.toEntity,
    };
  }

  protected createDomainEntity(
    databaseData: IKuDecisionDatabaseData,
    blockchainData: IKuDecisionBlockchainData
  ): KuDecisionDomainEntity {
    return new KuDecisionDomainEntity(databaseData, blockchainData);
  }

  protected getSyncKey(): string {
    return KuDecisionDomainEntity.getSyncKey();
  }

  async findByHash(hash: string): Promise<KuDecisionDomainEntity | null> {
    const entity = await this.repository.findOne({ where: { hash: hash.toLowerCase() } });
    return entity ? KuDecisionMapper.toDomain(entity) : null;
  }

  async update(entity: KuDecisionDomainEntity): Promise<KuDecisionDomainEntity> {
    const updateData = KuDecisionMapper.toUpdateEntity(entity);
    await this.repository.update(entity._id, updateData);

    const updatedEntity = await this.repository.findOne({ where: { _id: entity._id } });
    if (!updatedEntity) {
      throw new Error(`Решение собрания участка ${entity.hash} не найдено после обновления`);
    }

    return KuDecisionMapper.toDomain(updatedEntity);
  }

  async findAllPaginated(
    filter?: KuDecisionFilterDomainInterface,
    options?: PaginationInputDomainInterface
  ): Promise<PaginationResultDomainInterface<KuDecisionDomainEntity>> {
    const validatedOptions: PaginationInputDomainInterface = options
      ? PaginationUtils.validatePaginationOptions(options)
      : { page: 1, limit: 10, sortBy: undefined, sortOrder: 'ASC' as const };

    const { limit, offset } = PaginationUtils.getSqlPaginationParams(validatedOptions);

    const where: any = {};
    if (filter?.coopname) where.coopname = filter.coopname;
    if (filter?.type) where.type = filter.type;
    if (filter?.status) where.status = filter.status;
    if (filter?.braname) where.braname = filter.braname;
    if (filter?.initiator) where.initiator = filter.initiator;
    if (filter?.present !== undefined) where.present = filter.present;

    const totalCount = await this.repository.count({ where });

    const orderBy: any = {};
    if (validatedOptions.sortBy) {
      orderBy[validatedOptions.sortBy] = validatedOptions.sortOrder;
    } else {
      orderBy._created_at = 'DESC';
    }

    const entities = await this.repository.find({
      where,
      skip: offset,
      take: limit,
      order: orderBy,
    });

    const items = entities.map((entity) => KuDecisionMapper.toDomain(entity));

    return PaginationUtils.createPaginationResult(items, totalCount, validatedOptions);
  }
}
