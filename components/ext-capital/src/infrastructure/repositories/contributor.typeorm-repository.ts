import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ContributorRepository } from '../../domain/repositories/contributor.repository';
import { ContributorDomainEntity } from '../../domain/entities/contributor.entity';
import { ContributorTypeormEntity } from '../entities/contributor.typeorm-entity';
import { ContributorMapper } from '../mappers/contributor.mapper';
import { CAPITAL_DATABASE_CONNECTION } from '../database/capital-database.module';
import type { IBlockchainSyncRepository } from '~/shared/interfaces/blockchain-sync.interface';
import { BaseBlockchainRepository } from '~/shared/sync/repositories/base-blockchain.repository';
import { EntityVersioningService } from '~/shared/sync/services/entity-versioning.service';
import { IContributorDatabaseData } from '../../domain/interfaces/contributor-database.interface';
import type {
  PaginationInputDomainInterface,
  PaginationResultDomainInterface,
} from '~/domain/common/interfaces/pagination.interface';
import type { ContributorFilterInputDTO } from '../../application/dto/participation_management/contributor-filter.input';
import { PaginationUtils } from '~/shared/utils/pagination.utils';
import type { ContributorStatus } from '../../domain/enums/contributor-status.enum';
import { AppendixStatus } from '../../domain/enums/appendix-status.enum';

@Injectable()
export class ContributorTypeormRepository
  extends BaseBlockchainRepository<ContributorDomainEntity, ContributorTypeormEntity>
  implements ContributorRepository, IBlockchainSyncRepository<ContributorDomainEntity>
{
  constructor(
    @InjectRepository(ContributorTypeormEntity, CAPITAL_DATABASE_CONNECTION)
    repository: Repository<ContributorTypeormEntity>,
    entityVersioningService: EntityVersioningService
  ) {
    super(repository, entityVersioningService);
  }

  protected getMapper() {
    return {
      toDomain: ContributorMapper.toDomain,
      toEntity: ContributorMapper.toEntity,
    };
  }

  protected getSyncKey(): string {
    return ContributorDomainEntity.getSyncKey();
  }

  protected createDomainEntity(databaseData: IContributorDatabaseData, blockchainData: any): ContributorDomainEntity {
    return new ContributorDomainEntity(databaseData, blockchainData);
  }

  async create(contributor: ContributorDomainEntity): Promise<ContributorDomainEntity> {
    const entity = this.repository.create(ContributorMapper.toEntity(contributor));
    const savedEntity = await this.repository.save(entity);
    return ContributorMapper.toDomain(savedEntity);
  }

  async findByUsername(username: string): Promise<ContributorDomainEntity | null> {
    const entities = await this.repository.find({ where: { username } });
    return entities.length > 0 ? ContributorMapper.toDomain(entities[0]) : null;
  }

  async findByUsernameAndCoopname(username: string, coopname: string): Promise<ContributorDomainEntity | null> {
    const entities = await this.repository.find({ where: { username, coopname } });
    return entities.length > 0 ? ContributorMapper.toDomain(entities[0]) : null;
  }

  async findByStatusAndCoopname(status: ContributorStatus, coopname: string): Promise<ContributorDomainEntity[]> {
    const entities = await this.repository.find({ where: { status: status, coopname } });
    return entities.map((entity) => ContributorMapper.toDomain(entity));
  }

  async findByHashesAndStatus(contributorHashes: string[], status: string): Promise<ContributorDomainEntity[]> {
    const entities = await this.repository.find({
      where: {
        contributor_hash: In(contributorHashes),
        status: status as ContributorStatus,
      },
    });
    return entities.map((entity) => ContributorMapper.toDomain(entity));
  }

  async findOne(criteria: {
    _id?: string;
    username?: string;
    contributor_hash?: string;
  }): Promise<ContributorDomainEntity | null> {
    // Проверяем наличие хотя бы одного критерия поиска
    if (!criteria._id && !criteria.username && !criteria.contributor_hash) {
      throw new Error('Необходимо указать хотя бы одно из полей: _id, username или contributor_hash');
    }

    // Строим query builder для поиска с AND условиями
    const queryBuilder = this.repository.createQueryBuilder('contributor');

    // Добавляем условия поиска с AND логикой
    if (criteria._id) {
      queryBuilder.andWhere('contributor._id = :_id', { _id: criteria._id });
    }
    if (criteria.username) {
      queryBuilder.andWhere('contributor.username = :username', { username: criteria.username });
    }
    if (criteria.contributor_hash) {
      queryBuilder.andWhere('contributor.contributor_hash = :contributor_hash', {
        contributor_hash: criteria.contributor_hash,
      });
    }

    // Получаем результат
    const entity = await queryBuilder.getOne();

    // Возвращаем результат или null
    return entity ? ContributorMapper.toDomain(entity) : null;
  }

  async findByStatus(status: string): Promise<ContributorDomainEntity[]> {
    const entities = await this.repository.find({ where: { status: status as any } });
    return entities.map((entity) => ContributorMapper.toDomain(entity));
  }

  async findAllPaginated(
    filter?: ContributorFilterInputDTO,
    options?: PaginationInputDomainInterface
  ): Promise<PaginationResultDomainInterface<ContributorDomainEntity>> {
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

    // Строим query builder для сложных условий поиска
    const queryBuilder = this.repository.createQueryBuilder('contributor');

    // Добавляем базовые условия
    if (filter?.username) {
      queryBuilder.andWhere('contributor.username = :username', { username: filter.username });
    }
    if (filter?.status) {
      queryBuilder.andWhere('contributor.status = :status', { status: filter.status });
    }
    if (filter?.coopname) {
      queryBuilder.andWhere('contributor.coopname = :coopname', { coopname: filter.coopname });
    }
    if (filter?.contributor_hash) {
      queryBuilder.andWhere('contributor.contributor_hash = :contributor_hash', {
        contributor_hash: filter.contributor_hash,
      });
    }
    if (filter?.is_external_contract !== undefined) {
      queryBuilder.andWhere('contributor.is_external_contract = :is_external_contract', {
        is_external_contract: filter.is_external_contract,
      });
    }
    if (filter?.display_name) {
      // Используем LIKE для частичного поиска по display_name (регистронезависимый)
      queryBuilder.andWhere('contributor.display_name ILIKE :display_name', { display_name: `%${filter.display_name}%` });
    }

    if (filter?.project_hash) {
      // Фильтруем по наличию CONFIRMED appendix с соответствующим project_hash
      queryBuilder.innerJoin(
        'capital_appendixes',
        'appendix',
        'appendix.username = contributor.username AND appendix.coopname = contributor.coopname'
      );
      queryBuilder.andWhere('appendix.project_hash = :project_hash', { project_hash: filter.project_hash });
      queryBuilder.andWhere('appendix.status = :status', { status: AppendixStatus.CONFIRMED });
    }

    // Получаем общее количество записей
    const totalCount = await queryBuilder.getCount();

    // Добавляем сортировку
    if (validatedOptions.sortBy) {
      queryBuilder.orderBy(`contributor.${validatedOptions.sortBy}`, validatedOptions.sortOrder);
    } else {
      queryBuilder.orderBy('contributor.created_at', 'DESC');
    }

    // Добавляем пагинацию
    queryBuilder.skip(offset).take(limit);

    // Получаем записи
    const entities = await queryBuilder.getMany();

    // Преобразуем в доменные сущности
    const items = entities.map((entity) => ContributorMapper.toDomain(entity));

    // Возвращаем результат с пагинацией
    return PaginationUtils.createPaginationResult(items, totalCount, validatedOptions);
  }
}
