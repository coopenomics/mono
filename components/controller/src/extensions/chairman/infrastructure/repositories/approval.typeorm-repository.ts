import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApprovalDomainEntity } from '../../domain/entities/approval.entity';
import { ApprovalTypeormEntity } from '../entities/approval-typeorm.entity';
import { ApprovalMapper } from '../mappers/approval.mapper';
import { BaseBlockchainRepository, EntityVersioningService } from '@coopenomics/extension-kit/sync';
import type { ApprovalRepository } from '../../domain/repositories/approval.repository';
import type { ApprovalFilterInput } from '../../application/dto/approval-filter.input';
import { PaginationInputDTO, PaginationResult, PaginationUtils } from '@coopenomics/extension-kit';

/**
 * TypeORM реализация репозитория одобрений
 */
@Injectable()
export class ApprovalTypeormRepository
  extends BaseBlockchainRepository<ApprovalDomainEntity, ApprovalTypeormEntity>
  implements ApprovalRepository
{
  constructor(
    @InjectRepository(ApprovalTypeormEntity)
    repository: Repository<ApprovalTypeormEntity>,
    entityVersioningService: EntityVersioningService
  ) {
    super(repository, entityVersioningService);
  }

  protected getMapper() {
    return {
      toDomain: ApprovalMapper.toDomain,
      toEntity: ApprovalMapper.toEntity,
    };
  }

  protected createDomainEntity(databaseData: any, blockchainData: any): ApprovalDomainEntity {
    return new ApprovalDomainEntity(databaseData, blockchainData);
  }

  protected getSyncKey(): string {
    return ApprovalDomainEntity.getSyncKey();
  }

  // Пагинированный поиск с фильтрами
  async findAllPaginated(
    filter?: ApprovalFilterInput,
    options?: PaginationInputDTO
  ): Promise<PaginationResult<ApprovalDomainEntity>> {
    // Валидируем параметры пагинации
    const validatedOptions: PaginationInputDTO = options
      ? PaginationUtils.validatePaginationOptions(options)
      : {
          page: 1,
          limit: 50,
          sortBy: undefined,
          sortOrder: 'DESC' as const,
        };

    // Получаем параметры для SQL запроса
    const { limit, offset } = PaginationUtils.getSqlPaginationParams(validatedOptions);

    // Строим query builder для сложных условий поиска
    const queryBuilder = this.repository.createQueryBuilder('approval');

    // Добавляем условия фильтрации
    if (filter?.coopname) {
      queryBuilder.andWhere('approval.coopname = :coopname', { coopname: filter.coopname });
    }
    if (filter?.username) {
      queryBuilder.andWhere('approval.username = :username', { username: filter.username });
    }
    if (filter?.statuses && filter.statuses.length > 0) {
      queryBuilder.andWhere('approval.status IN (:...statuses)', { statuses: filter.statuses });
    }
    if (filter?.approval_hash) {
      // Используем LIKE для частичного поиска
      queryBuilder.andWhere('approval.approval_hash ILIKE :approval_hash', { approval_hash: `%${filter.approval_hash}%` });
    }
    if (filter?.created_from) {
      queryBuilder.andWhere('approval.created_at >= :created_from', { created_from: filter.created_from });
    }
    if (filter?.created_to) {
      queryBuilder.andWhere('approval.created_at <= :created_to', { created_to: filter.created_to });
    }

    // Получаем общее количество записей
    const totalCount = await queryBuilder.getCount();

    // Добавляем сортировку
    if (validatedOptions.sortBy) {
      queryBuilder.orderBy(`approval.${validatedOptions.sortBy}`, validatedOptions.sortOrder);
    } else {
      queryBuilder.orderBy('approval.created_at', 'DESC');
    }

    // Добавляем пагинацию
    queryBuilder.skip(offset).take(limit);

    // Получаем записи
    const entities = await queryBuilder.getMany();

    // Преобразуем в доменные сущности
    const items = entities.map((entity) => ApprovalMapper.toDomain(entity));

    // Возвращаем результат с пагинацией
    return PaginationUtils.createPaginationResult(items, totalCount, validatedOptions);
  }

  // Специфичные методы репозитория одобрений
  async findByCoopname(coopname: string): Promise<ApprovalDomainEntity[]> {
    const entities = await this.repository.find({
      where: { coopname },
    });
    return entities.map(ApprovalMapper.toDomain);
  }

  async findByUsername(username: string): Promise<ApprovalDomainEntity[]> {
    const entities = await this.repository.find({
      where: { username },
    });
    return entities.map(ApprovalMapper.toDomain);
  }

  async findByApprovalHash(approvalHash: string): Promise<ApprovalDomainEntity | null> {
    const entity = await this.repository.findOne({
      where: { approval_hash: approvalHash.toLowerCase() },
    });
    return entity ? ApprovalMapper.toDomain(entity) : null;
  }

  // Все типовые CRUD методы наследуются от BaseBlockchainRepository
}
