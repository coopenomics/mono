import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VoteRepository } from '../../domain/repositories/vote.repository';
import { VoteDomainEntity } from '../../domain/entities/vote.entity';
import { VoteTypeormEntity } from '../entities/vote.typeorm-entity';
import { VoteMapper } from '../mappers/vote.mapper';
import { CAPITAL_DATABASE_CONNECTION } from '../database/capital-database.module';
import type { IBlockchainSyncRepository } from '~/shared/interfaces/blockchain-sync.interface';
import { BaseBlockchainRepository } from '~/shared/sync/repositories/base-blockchain.repository';
import { EntityVersioningService } from '~/shared/sync/services/entity-versioning.service';
import type { IVoteDatabaseData } from '../../domain/interfaces/vote-database.interface';
import type { IVoteBlockchainData } from '../../domain/interfaces/vote-blockchain.interface';
import type {
  PaginationInputDomainInterface,
  PaginationResultDomainInterface,
} from '~/domain/common/interfaces/pagination.interface';
import type { VoteFilterInputDTO } from '../../application/dto/voting/vote-filter.input';
import { PaginationUtils } from '~/shared/utils/pagination.utils';

@Injectable()
export class VoteTypeormRepository
  extends BaseBlockchainRepository<VoteDomainEntity, VoteTypeormEntity>
  implements VoteRepository, IBlockchainSyncRepository<VoteDomainEntity>
{
  constructor(
    @InjectRepository(VoteTypeormEntity, CAPITAL_DATABASE_CONNECTION)
    repository: Repository<VoteTypeormEntity>,
    entityVersioningService: EntityVersioningService
  ) {
    super(repository, entityVersioningService);
  }

  protected getMapper() {
    return {
      toDomain: VoteMapper.toDomain,
      toEntity: VoteMapper.toEntity,
    };
  }

  protected createDomainEntity(databaseData: IVoteDatabaseData, blockchainData: IVoteBlockchainData): VoteDomainEntity {
    return new VoteDomainEntity(databaseData, blockchainData, {});
  }

  protected getSyncKey(): string {
    return VoteDomainEntity.getSyncKey();
  }

  async create(vote: VoteDomainEntity): Promise<VoteDomainEntity> {
    const entity = this.repository.create(VoteMapper.toEntity(vote));
    const savedEntity = await this.repository.save(entity);
    return VoteMapper.toDomain(savedEntity);
  }

  async findByVoter(voter: string): Promise<VoteDomainEntity[]> {
    const entities = await this.repository.find({ where: { voter } });
    return entities.map((entity) => VoteMapper.toDomain(entity));
  }

  async findByRecipient(recipient: string): Promise<VoteDomainEntity[]> {
    const entities = await this.repository.find({ where: { recipient } });
    return entities.map((entity) => VoteMapper.toDomain(entity));
  }

  async findByProjectHash(projectHash: string): Promise<VoteDomainEntity[]> {
    const entities = await this.repository.find({ where: { project_hash: projectHash } });
    return entities.map((entity) => VoteMapper.toDomain(entity));
  }

  async findByCoopname(coopname: string): Promise<VoteDomainEntity[]> {
    const entities = await this.repository.find({ where: { coopname } });
    return entities.map((entity) => VoteMapper.toDomain(entity));
  }

  /**
   * Обновление голоса в базе данных
   * Принимает доменную сущность и обновляет соответствующие поля в TypeORM сущности
   */
  async update(entity: VoteDomainEntity): Promise<VoteDomainEntity> {
    // Преобразуем доменную сущность в данные для обновления
    const updateData = VoteMapper.toUpdateEntity(entity);

    // Обновляем запись в базе данных
    await this.repository.update(entity._id, updateData);

    // Получаем обновленную сущность из базы данных
    const updatedEntity = await this.repository.findOne({ where: { _id: entity._id } });
    if (!updatedEntity) {
      throw new Error(`Vote with id ${entity.id} not found after update`);
    }

    // Возвращаем обновленную доменную сущность
    return VoteMapper.toDomain(updatedEntity);
  }

  async findAllPaginated(
    filter?: VoteFilterInputDTO,
    options?: PaginationInputDomainInterface
  ): Promise<PaginationResultDomainInterface<VoteDomainEntity>> {
    // Валидируем параметры пагинации
    const validatedOptions: PaginationInputDomainInterface = options
      ? PaginationUtils.validatePaginationOptions(options)
      : {
          page: 1,
          limit: 10,
          sortBy: undefined,
          sortOrder: 'ASC' as const,
        };

    // Получаем параметры для SQL запроса
    const { limit, offset } = PaginationUtils.getSqlPaginationParams(validatedOptions);

    // Строим условия поиска
    const where: any = {};
    if (filter?.voter) {
      where.voter = filter.voter;
    }
    if (filter?.recipient) {
      where.recipient = filter.recipient;
    }
    if (filter?.project_hash) {
      where.project_hash = filter.project_hash;
    }
    if (filter?.coopname) {
      where.coopname = filter.coopname;
    }

    // Получаем общее количество записей
    const totalCount = await this.repository.count({ where });

    // Получаем записи с пагинацией
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
      relations: ['voter_contributor', 'recipient_contributor'], // Загружаем связанных contributor'ов
    });

    // Преобразуем в доменные сущности
    const items = entities.map((entity) => VoteMapper.toDomain(entity));

    // Возвращаем результат с пагинацией
    return PaginationUtils.createPaginationResult(items, totalCount, validatedOptions);
  }
}
