import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgreementDomainEntity } from '~/domain/agreement/entities/agreement.entity';
import { AgreementTypeormEntity } from '../entities/agreement.typeorm-entity';
import { AgreementMapper } from '../mappers/agreement.mapper';
import type { AgreementRepository, AgreementFilterInput } from '~/domain/agreement/repositories/agreement.repository';
import type { IBlockchainSyncRepository } from '@coopenomics/extension-kit/sync';
import { BaseBlockchainRepository, EntityVersioningService } from '@coopenomics/extension-kit/sync';
import type { IAgreementBlockchainData } from '~/domain/agreement/interfaces/agreement-blockchain.interface';
import type { IAgreementDatabaseData } from '~/domain/agreement/interfaces/agreement-database.interface';
import type {
  PaginationInputDomainInterface,
  PaginationResultDomainInterface,
} from '~/domain/common/interfaces/pagination.interface';
import { PaginationUtils } from '~/shared/utils/pagination.utils';

/**
 * TypeORM реализация репозитория соглашений
 */
@Injectable()
export class AgreementTypeormRepository
  extends BaseBlockchainRepository<AgreementDomainEntity, AgreementTypeormEntity>
  implements AgreementRepository, IBlockchainSyncRepository<AgreementDomainEntity>
{
  constructor(
    @InjectRepository(AgreementTypeormEntity)
    repository: Repository<AgreementTypeormEntity>,
    entityVersioningService: EntityVersioningService
  ) {
    super(repository, entityVersioningService);
  }

  protected getMapper() {
    return {
      toDomain: AgreementMapper.toDomain,
      toEntity: AgreementMapper.toEntity,
    };
  }

  protected createDomainEntity(
    databaseData: IAgreementDatabaseData,
    blockchainData: IAgreementBlockchainData
  ): AgreementDomainEntity {
    return new AgreementDomainEntity(databaseData, blockchainData);
  }

  protected getSyncKey(): string {
    return AgreementDomainEntity.getSyncKey();
  }

  // Пагинированный поиск с фильтрами
  async findAllPaginated(
    filter?: AgreementFilterInput,
    options?: PaginationInputDomainInterface
  ): Promise<PaginationResultDomainInterface<AgreementDomainEntity>> {
    // Валидируем параметры пагинации
    const validatedOptions: PaginationInputDomainInterface = options
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
    const queryBuilder = this.repository.createQueryBuilder('agreement');

    // Добавляем условия фильтрации
    if (filter?.coopname) {
      queryBuilder.andWhere('agreement.coopname = :coopname', { coopname: filter.coopname });
    }
    if (filter?.username) {
      queryBuilder.andWhere('agreement.username = :username', { username: filter.username });
    }
    if (filter?.type) {
      queryBuilder.andWhere('agreement.type = :type', { type: filter.type });
    }
    if (filter?.program_id !== undefined) {
      queryBuilder.andWhere('agreement.program_id = :program_id', { program_id: filter.program_id });
    }
    if (filter?.statuses && filter.statuses.length > 0) {
      queryBuilder.andWhere('agreement.blockchain_status IN (:...statuses)', { statuses: filter.statuses });
    }
    if (filter?.created_from) {
      queryBuilder.andWhere('agreement._created_at >= :created_from', { created_from: filter.created_from });
    }
    if (filter?.created_to) {
      queryBuilder.andWhere('agreement._created_at <= :created_to', { created_to: filter.created_to });
    }

    // Получаем общее количество записей
    const totalCount = await queryBuilder.getCount();

    // Добавляем сортировку
    if (validatedOptions.sortBy) {
      queryBuilder.orderBy(`agreement.${validatedOptions.sortBy}`, validatedOptions.sortOrder);
    } else {
      queryBuilder.orderBy('agreement._created_at', 'DESC');
    }

    // Добавляем пагинацию
    queryBuilder.skip(offset).take(limit);

    // Получаем записи
    const entities = await queryBuilder.getMany();

    // Преобразуем в доменные сущности
    const items = entities.map((entity) => AgreementMapper.toDomain(entity));

    // Возвращаем результат с пагинацией
    return PaginationUtils.createPaginationResult(items, totalCount, validatedOptions);
  }

  // Специфичные методы репозитория соглашений
  async findByCoopname(coopname: string): Promise<AgreementDomainEntity[]> {
    const entities = await this.repository.find({
      where: { coopname },
    });
    return entities.map(AgreementMapper.toDomain);
  }

  async findByUsername(username: string): Promise<AgreementDomainEntity[]> {
    const entities = await this.repository.find({
      where: { username },
    });
    return entities.map(AgreementMapper.toDomain);
  }

  async findByType(type: string): Promise<AgreementDomainEntity[]> {
    const entities = await this.repository.find({
      where: { type },
    });
    return entities.map(AgreementMapper.toDomain);
  }

  async findByProgramId(program_id: number): Promise<AgreementDomainEntity[]> {
    const entities = await this.repository.find({
      where: { program_id: program_id },
    });
    return entities.map(AgreementMapper.toDomain);
  }
}
