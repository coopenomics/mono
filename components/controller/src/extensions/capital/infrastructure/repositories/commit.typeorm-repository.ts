import { CAPITAL_CONTRIBUTOR_STORE, CAPITAL_COMMIT_STORE } from '../database/capital-stores';
import type { ContributorTypeormEntity } from '../entities/contributor.typeorm-entity';
import { attachOne, PaginationInputDTO, PaginationResult, PaginationUtils, type SqlBuilder, type TableStore } from '@coopenomics/extension-kit';
import { Inject, Injectable } from '@nestjs/common';
import { CommitRepository } from '../../domain/repositories/commit.repository';
import { CommitDomainEntity } from '../../domain/entities/commit.entity';
import { CommitTypeormEntity } from '../entities/commit.typeorm-entity';
import { CommitMapper } from '../mappers/commit.mapper';
import { BaseChainRepository, ChainVersioningService, type IBlockchainSyncRepository } from '@coopenomics/extension-kit/sync';
import type { ICommitBlockchainData } from '../../domain/interfaces/commit-blockchain.interface';
import type { ICommitDatabaseData } from '../../domain/interfaces/commit-database.interface';
import type { CommitFilterInputDTO } from '../../application/dto/generation/commit-filter.input';

@Injectable()
export class CommitTypeormRepository
  extends BaseChainRepository<CommitDomainEntity, CommitTypeormEntity>
  implements CommitRepository, IBlockchainSyncRepository<CommitDomainEntity>
{
  constructor(
    @Inject(CAPITAL_COMMIT_STORE) repository: TableStore<CommitTypeormEntity>,
    @Inject(ChainVersioningService) versioning: ChainVersioningService,
    @Inject(CAPITAL_CONTRIBUTOR_STORE) private readonly contributors: TableStore<ContributorTypeormEntity>
  ) {
    super(repository, versioning);
  }

  /** Участник коммита: из его записи берётся отображаемое имя. */
  private async attachRelations(commits: CommitTypeormEntity[]): Promise<void> {
    await attachOne(commits, this.contributors, 'contributor', { coopname: 'coopname', username: 'username' });
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
    queryBuilder: SqlBuilder<CommitTypeormEntity>,
    filter?: CommitFilterInputDTO
  ): SqlBuilder<CommitTypeormEntity> {
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
    if (filter.review_for_master) {
      queryBuilder = queryBuilder
        .innerJoin('capital_projects', 'p_rev', 'p_rev.project_hash = c.project_hash')
        .leftJoin('capital_projects', 'p_parent', 'p_parent.project_hash = p_rev.parent_hash')
        .andWhere('(p_rev.master = :reviewMaster OR p_parent.master = :reviewMaster)', {
          reviewMaster: filter.review_for_master,
        });
    }

    return queryBuilder;
  }

  async findByCommitHash(commitHash: string): Promise<CommitDomainEntity | null> {
    const entity = await this.repository
      .sqlBuilder('c')
      .where('c.commit_hash = :commitHash', { commitHash: commitHash.toLowerCase() })
      .getOne();
    if (entity) await this.attachRelations([entity]);

    return entity ? CommitMapper.toDomain(entity) : null;
  }

  async findByUsername(username: string): Promise<CommitDomainEntity[]> {
    const entities = await this.repository
      .sqlBuilder('c')
      .where('c.username = :username', { username })
      .getMany();
    await this.attachRelations(entities);

    return entities.map((entity) => CommitMapper.toDomain(entity));
  }

  async findByProjectHash(projectHash: string): Promise<CommitDomainEntity[]> {
    const entities = await this.repository
      .sqlBuilder('c')
      .where('c.project_hash = :projectHash', { projectHash: projectHash.toLowerCase() })
      .getMany();
    await this.attachRelations(entities);

    return entities.map((entity) => CommitMapper.toDomain(entity));
  }

  async findByStatus(status: string): Promise<CommitDomainEntity[]> {
    const entities = await this.repository
      .sqlBuilder('c')
      .where('c.status = :status', { status: status as any })
      .getMany();
    await this.attachRelations(entities);

    return entities.map((entity) => CommitMapper.toDomain(entity));
  }

  async findAllPaginated(
    filter?: CommitFilterInputDTO,
    options?: PaginationInputDTO
  ): Promise<PaginationResult<CommitDomainEntity>> {
    // Валидируем параметры пагинации
    const validatedOptions: PaginationInputDTO = options
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
    let queryBuilder = this.repository.sqlBuilder('c').select('c').where('1=1'); // Начальное условие для удобства добавления AND

    // Применяем фильтры
    queryBuilder = this.applyFiltersToQueryBuilder(queryBuilder, filter);

    // Получаем общее количество записей
    const totalCount = await queryBuilder.getCount();

    // Применяем сортировку
    const sortColumn = this.repository.sortField(validatedOptions.sortBy, 'created_at');
    queryBuilder = queryBuilder.orderBy(
      `c.${sortColumn}`,
      validatedOptions.sortBy ? validatedOptions.sortOrder : 'DESC'
    );

    // Применяем пагинацию
    queryBuilder = queryBuilder.offset(offset).limit(limit);

    // Получаем записи
    const entities = await queryBuilder.getMany();
    await this.attachRelations(entities);

    // Преобразуем в доменные сущности
    const items = entities.map((entity) => CommitMapper.toDomain(entity));

    // Возвращаем результат с пагинацией
    return PaginationUtils.createPaginationResult(items, totalCount, validatedOptions);
  }
}
