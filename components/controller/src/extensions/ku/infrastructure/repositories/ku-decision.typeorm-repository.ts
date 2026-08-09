import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { IBlockchainSyncRepository } from '@coopenomics/extension-kit/sync';
import { BaseBlockchainRepository, EntityVersioningService } from '@coopenomics/extension-kit/sync';
import type {
  KuDecisionFilterDomainInterface,
  KuDecisionPrivateDataDomainInterface,
  KuDecisionRepository,
} from '../../domain/repositories/ku-decision.repository';
import { KuDecisionDomainEntity } from '../../domain/entities/ku-decision.entity';
import { KuDecisionTypeormEntity } from '../entities/ku-decision.typeorm-entity';
import { KuDecisionMapper } from '../mappers/ku-decision.mapper';
import type {
  IKuDecisionBlockchainData,
  IKuDecisionDatabaseData,
} from '../../domain/interfaces/ku-blockchain-data.interface';
import { PaginationInputDTO, PaginationResult, PaginationUtils } from '@coopenomics/extension-kit';

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

  async upsertPrivateData(data: KuDecisionPrivateDataDomainInterface): Promise<void> {
    const hash = data.hash.toLowerCase();
    const existing = await this.repository.findOne({ where: { hash } });

    const privateFields: Partial<KuDecisionTypeormEntity> = {};
    if (data.meet_place !== undefined) privateFields.meet_place = data.meet_place;
    if (data.meet_at !== undefined) privateFields.meet_at = data.meet_at;
    if (data.branch_name !== undefined) privateFields.branch_name = data.branch_name;
    if (data.branch_email !== undefined) privateFields.branch_email = data.branch_email;
    if (data.branch_phone !== undefined) privateFields.branch_phone = data.branch_phone;
    if (data.cancelled !== undefined) privateFields.cancelled = data.cancelled;

    if (existing) {
      await this.repository.update(existing._id, privateFields);
      return;
    }

    // Запись из синка ещё не пришла — создаём placeholder, который синк дополнит
    await this.repository.save(
      this.repository.create({
        hash,
        coopname: data.coopname ?? '',
        type: data.type ?? '',
        initiator: data.initiator ?? '',
        present: false,
        ...privateFields,
      })
    );
  }

  async findMeetingsForReminder(from: Date, to: Date): Promise<KuDecisionDomainEntity[]> {
    const entities = await this.repository
      .createQueryBuilder('decision')
      .where('decision.present = true')
      .andWhere('decision.cancelled = false')
      .andWhere('decision.meet_reminder_sent = false')
      .andWhere('decision.meet_at >= :from AND decision.meet_at < :to', { from, to })
      .getMany();
    return entities.map((entity) => KuDecisionMapper.toDomain(entity));
  }

  async markReminderSent(hash: string): Promise<void> {
    await this.repository.update({ hash: hash.toLowerCase() }, { meet_reminder_sent: true });
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
    options?: PaginationInputDTO
  ): Promise<PaginationResult<KuDecisionDomainEntity>> {
    const validatedOptions: PaginationInputDTO = options
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
