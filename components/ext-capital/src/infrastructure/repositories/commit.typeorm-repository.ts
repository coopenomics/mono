import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { CommitRepository } from '../../domain/repositories/commit.repository';
import { CommitDomainEntity } from '../../domain/entities/commit.entity';
import { CommitTypeormEntity } from '../entities/commit.typeorm-entity';
import { CommitMapper } from '../mappers/commit.mapper';
import { CAPITAL_DATABASE_CONNECTION } from '../database/capital-database.module';
import type { IBlockchainSyncRepository } from '~/shared/interfaces/blockchain-sync.interface';
import type { ICommitBlockchainData } from '../../domain/interfaces/commit-blockchain.interface';
import { BaseBlockchainRepository } from '~/shared/sync/repositories/base-blockchain.repository';
import { EntityVersioningService } from '~/shared/sync/services/entity-versioning.service';
import type { ICommitDatabaseData } from '../../domain/interfaces/commit-database.interface';
import type {
  PaginationInputDomainInterface,
  PaginationResultDomainInterface,
} from '~/domain/common/interfaces/pagination.interface';
import type { CommitFilterInputDTO } from '../../application/dto/generation/commit-filter.input';
import { PaginationUtils } from '~/shared/utils/pagination.utils';

@Injectable()
export class CommitTypeormRepository
  extends BaseBlockchainRepository<CommitDomainEntity, CommitTypeormEntity>
  implements CommitRepository, IBlockchainSyncRepository<CommitDomainEntity>
{
  constructor(
    @InjectRepository(CommitTypeormEntity, CAPITAL_DATABASE_CONNECTION)
    repository: Repository<CommitTypeormEntity>,
    entityVersioningService: EntityVersioningService
  ) {
    super(repository, entityVersioningService);
  }

  protected getMapper() {
    return {
      toDomain: CommitMapper.toDomain,
      toEntity: CommitMapper.toEntity,
    };
  }

  protected createDomainEntity(
    databaseData: ICommitDatabaseData,
    blockchainData: ICommitBlockchainData
  ): CommitDomainEntity {
    return new CommitDomainEntity(databaseData, blockchainData);
  }

  protected getSyncKey(): string {
    return CommitDomainEntity.getSyncKey();
  }

  // Специфичные методы для CommitRepository

  private applyFiltersToQueryBuilder(
    queryBuilder: SelectQueryBuilder<CommitTypeormEntity>,
    filter?: CommitFilterInputDTO
  ): SelectQueryBuilder<CommitTypeormEntity> {
    if (!filter) {
      return queryBuilder;
    }

    // Применяем фильтры
    if (filter.commit_hash) {
      queryBuilder = queryBuilder.andWhere('c.commit_hash = :commit_hash', {
        commit_hash: filter.commit_hash.toLowerCase(),
      });
    }
    if (filter.status) {
      queryBuilder = queryBuilder.andWhere('c.status = :status', { status: filter.status });
    }
    if (filter.coopname) {
      queryBuilder = queryBuilder.andWhere('c.coopname = :coopname', { coopname: filter.coopname });
    }
    if (filter.username) {
      queryBuilder = queryBuilder.andWhere('c.username = :username', { username: filter.username });
    }
    if (filter.project_hash) {
      queryBuilder = queryBuilder.andWhere('c.project_hash = :project_hash', {
        project_hash: filter.project_hash.toLowerCase(),
      });
    }
    if (filter.blockchain_status) {
      queryBuilder = queryBuilder.andWhere('c.blockchain_status = :blockchain_status', {
        blockchain_status: filter.blockchain_status,
      });
    }
    if (filter.created_date) {
      queryBuilder = queryBuilder.andWhere('DATE(c.created_at) = :created_date', { created_date: filter.created_date });
    }

    return queryBuilder;
  }

  async findByCommitHash(commitHash: string): Promise<CommitDomainEntity | null> {
    const entity = await this.repository
      .createQueryBuilder('c')
      .leftJoinAndSelect(
        'c.contributor',
        'contributor',
        'contributor.coopname = c.coopname AND contributor.username = c.username'
      )
      .where('c.commit_hash = :commitHash', { commitHash: commitHash.toLowerCase() })
      .getOne();

    return entity ? CommitMapper.toDomain(entity) : null;
  }

  async findByUsername(username: string): Promise<CommitDomainEntity[]> {
    const entities = await this.repository
      .createQueryBuilder('c')
      .leftJoinAndSelect(
        'c.contributor',
        'contributor',
        'contributor.coopname = c.coopname AND contributor.username = c.username'
      )
      .where('c.username = :username', { username })
      .getMany();

    return entities.map((entity) => CommitMapper.toDomain(entity));
  }

  async findByProjectHash(projectHash: string): Promise<CommitDomainEntity[]> {
    const entities = await this.repository
      .createQueryBuilder('c')
      .leftJoinAndSelect(
        'c.contributor',
        'contributor',
        'contributor.coopname = c.coopname AND contributor.username = c.username'
      )
      .where('c.project_hash = :projectHash', { projectHash: projectHash.toLowerCase() })
      .getMany();

    return entities.map((entity) => CommitMapper.toDomain(entity));
  }

  async findByStatus(status: string): Promise<CommitDomainEntity[]> {
    const entities = await this.repository
      .createQueryBuilder('c')
      .leftJoinAndSelect(
        'c.contributor',
        'contributor',
        'contributor.coopname = c.coopname AND contributor.username = c.username'
      )
      .where('c.status = :status', { status: status as any })
      .getMany();

    return entities.map((entity) => CommitMapper.toDomain(entity));
  }

  async findAllPaginated(
    filter?: CommitFilterInputDTO,
    options?: PaginationInputDomainInterface
  ): Promise<PaginationResultDomainInterface<CommitDomainEntity>> {
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

    // Создаем query builder для гибкого построения запроса
    let queryBuilder = this.repository.createQueryBuilder('c').select('c').where('1=1'); // Начальное условие для удобства добавления AND

    // Применяем фильтры
    queryBuilder = this.applyFiltersToQueryBuilder(queryBuilder, filter);

    // Добавляем join с contributor для получения display_name
    queryBuilder = queryBuilder.leftJoinAndSelect(
      'c.contributor',
      'contributor',
      'contributor.coopname = c.coopname AND contributor.username = c.username'
    );

    // Получаем общее количество записей
    const totalCount = await queryBuilder.getCount();

    // Применяем сортировку
    if (validatedOptions.sortBy) {
      queryBuilder = queryBuilder.orderBy(`c.${validatedOptions.sortBy}`, validatedOptions.sortOrder);
    } else {
      queryBuilder = queryBuilder.orderBy('c.created_at', 'DESC');
    }

    // Применяем пагинацию
    queryBuilder = queryBuilder.skip(offset).take(limit);

    // Получаем записи
    const entities = await queryBuilder.getMany();

    // Преобразуем в доменные сущности
    const items = entities.map((entity) => CommitMapper.toDomain(entity));

    // Возвращаем результат с пагинацией
    return PaginationUtils.createPaginationResult(items, totalCount, validatedOptions);
  }
}
