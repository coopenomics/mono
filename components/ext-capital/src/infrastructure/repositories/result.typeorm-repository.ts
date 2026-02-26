import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ResultRepository } from '../../domain/repositories/result.repository';
import { ResultDomainEntity } from '../../domain/entities/result.entity';
import { ResultTypeormEntity } from '../entities/result.typeorm-entity';
import { ResultMapper } from '../mappers/result.mapper';
import { CAPITAL_DATABASE_CONNECTION } from '../database/capital-database.module';
import type { IBlockchainSyncRepository } from '~/shared/interfaces/blockchain-sync.interface';
import { BaseBlockchainRepository } from '~/shared/sync/repositories/base-blockchain.repository';
import { EntityVersioningService } from '~/shared/sync/services/entity-versioning.service';
import type { IResultBlockchainData } from '../../domain/interfaces/result-blockchain.interface';
import type { IResultDatabaseData } from '../../domain/interfaces/result-database.interface';
import type {
  PaginationInputDomainInterface,
  PaginationResultDomainInterface,
} from '~/domain/common/interfaces/pagination.interface';
import type { ResultFilterInputDTO } from '../../application/dto/result_submission/result-filter.input';
import { PaginationUtils } from '~/shared/utils/pagination.utils';

@Injectable()
export class ResultTypeormRepository
  extends BaseBlockchainRepository<ResultDomainEntity, ResultTypeormEntity>
  implements ResultRepository, IBlockchainSyncRepository<ResultDomainEntity>
{
  constructor(
    @InjectRepository(ResultTypeormEntity, CAPITAL_DATABASE_CONNECTION)
    repository: Repository<ResultTypeormEntity>,
    entityVersioningService: EntityVersioningService
  ) {
    super(repository, entityVersioningService);
  }

  protected getMapper() {
    return {
      toDomain: ResultMapper.toDomain,
      toEntity: ResultMapper.toEntity,
    };
  }

  protected createDomainEntity(
    databaseData: IResultDatabaseData,
    blockchainData: IResultBlockchainData
  ): ResultDomainEntity {
    return new ResultDomainEntity(databaseData, blockchainData);
  }

  protected getSyncKey(): string {
    return ResultDomainEntity.getSyncKey();
  }

  async create(result: ResultDomainEntity): Promise<ResultDomainEntity> {
    const entity = this.repository.create(ResultMapper.toEntity(result));
    const savedEntity = await this.repository.save(entity);
    return ResultMapper.toDomain(savedEntity);
  }

  async findByUsername(username: string): Promise<ResultDomainEntity[]> {
    const entities = await this.repository.find({ where: { username } });
    return entities.map((entity) => ResultMapper.toDomain(entity));
  }

  async findByProjectHash(projectHash: string): Promise<ResultDomainEntity[]> {
    const entities = await this.repository.find({ where: { project_hash: projectHash } });
    return entities.map((entity) => ResultMapper.toDomain(entity));
  }

  async findByResultHash(resultHash: string): Promise<ResultDomainEntity | null> {
    const entity = await this.repository.findOne({ where: { result_hash: resultHash } });
    return entity ? ResultMapper.toDomain(entity) : null;
  }

  async findByProjectHashAndUsername(projectHash: string, username: string): Promise<ResultDomainEntity | null> {
    const entity = await this.repository.findOne({ where: { project_hash: projectHash, username } });
    return entity ? ResultMapper.toDomain(entity) : null;
  }

  async findByStatus(status: string): Promise<ResultDomainEntity[]> {
    const entities = await this.repository.find({ where: { status: status as any } });
    return entities.map((entity) => ResultMapper.toDomain(entity));
  }

  /**
   * Построить условия WHERE для фильтрации результатов
   */
  private buildWhereConditions(filter?: ResultFilterInputDTO): any {
    const where: any = {};

    if (filter?.username) {
      where.username = filter.username;
    }

    if (filter?.projectHash) {
      where.project_hash = filter.projectHash;
    }

    if (filter?.status) {
      where.status = filter.status;
    }

    return where;
  }

  /**
   * Найти все результаты с пагинацией и фильтрацией
   */
  async findAllPaginated(
    filter?: ResultFilterInputDTO,
    options?: PaginationInputDomainInterface
  ): Promise<PaginationResultDomainInterface<ResultDomainEntity>> {
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
    const where = this.buildWhereConditions(filter);

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
    });

    // Преобразуем в доменные сущности
    const items = entities.map((entity) => ResultMapper.toDomain(entity));

    // Возвращаем результат с пагинацией
    return PaginationUtils.createPaginationResult(items, totalCount, validatedOptions);
  }
}
