import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { ProgramInvestDomainEntity } from '../../domain/entities/program-invest.entity';
import { ProgramInvestTypeormEntity } from '../entities/program-invest.typeorm-entity';
import { ProgramInvestMapper } from '../mappers/program-invest.mapper';
import type { ProgramInvestRepository } from '../../domain/repositories/program-invest.repository';
import { CAPITAL_DATABASE_CONNECTION } from '../database/capital-database.module';
import { BaseBlockchainRepository } from '~/shared/sync/repositories/base-blockchain.repository';
import { EntityVersioningService } from '~/shared/sync/services/entity-versioning.service';
import type { IProgramInvestDatabaseData } from '../../domain/interfaces/program-invest-database.interface';
import type { IProgramInvestBlockchainData } from '../../domain/interfaces/program-invest-blockchain.interface';
import type {
  PaginationInputDomainInterface,
  PaginationResultDomainInterface,
} from '~/domain/common/interfaces/pagination.interface';
import type { InvestFilterInputDTO } from '../../application/dto/invests_management/invest-filter.input';
import { PaginationUtils } from '~/shared/utils/pagination.utils';

/**
 * TypeORM реализация репозитория программных инвестиций
 */
@Injectable()
export class ProgramInvestTypeormRepository
  extends BaseBlockchainRepository<ProgramInvestDomainEntity, ProgramInvestTypeormEntity>
  implements ProgramInvestRepository
{
  constructor(
    @InjectRepository(ProgramInvestTypeormEntity, CAPITAL_DATABASE_CONNECTION)
    repository: Repository<ProgramInvestTypeormEntity>,
    entityVersioningService: EntityVersioningService
  ) {
    super(repository, entityVersioningService);
  }

  protected getMapper() {
    return {
      toDomain: ProgramInvestMapper.toDomain,
      toEntity: ProgramInvestMapper.toEntity,
    };
  }


  protected createDomainEntity(
    databaseData: IProgramInvestDatabaseData,
    blockchainData: IProgramInvestBlockchainData
  ): ProgramInvestDomainEntity {
    return new ProgramInvestDomainEntity(databaseData, blockchainData);
  }

  protected getSyncKey(): string {
    return ProgramInvestDomainEntity.getSyncKey();
  }

  async findAllPaginated(
    filter?: InvestFilterInputDTO,
    options?: PaginationInputDomainInterface
  ): Promise<PaginationResultDomainInterface<ProgramInvestDomainEntity>> {
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
    if (filter?.username) {
      where.username = filter.username;
    }
    if (filter?.status) {
      where.status = filter.status;
    }

    // Получаем общее количество записей
    const totalCount = await this.repository.count({ where });

    // Получаем записи с пагинацией
    const orderBy: any = {};
    if (validatedOptions.sortBy) {
      orderBy[validatedOptions.sortBy] = validatedOptions.sortOrder;
    } else {
      orderBy.created_at = 'DESC';
    }

    const entities = await this.repository.find({
      where,
      skip: offset,
      take: limit,
      order: orderBy,
    });

    // Преобразуем в доменные сущности
    const items = entities.map((entity) => ProgramInvestMapper.toDomain(entity));

    // Возвращаем результат с пагинацией
    return PaginationUtils.createPaginationResult(items, totalCount, validatedOptions);
  }
}
