import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InvestRepository } from '../../domain/repositories/invest.repository';
import { InvestDomainEntity } from '../../domain/entities/invest.entity';
import { InvestTypeormEntity } from '../entities/invest.typeorm-entity';
import { InvestMapper } from '../mappers/invest.mapper';
import { CAPITAL_DATABASE_CONNECTION } from '../database/capital-database.module';
import type { IBlockchainSyncRepository } from '~/shared/interfaces/blockchain-sync.interface';
import { BaseBlockchainRepository } from '~/shared/sync/repositories/base-blockchain.repository';
import { EntityVersioningService } from '~/shared/sync/services/entity-versioning.service';
import type { IInvestDatabaseData } from '../../domain/interfaces/invest-database.interface';
import type { IInvestBlockchainData } from '../../domain/interfaces/invest-blockchain.interface';
import type {
  PaginationInputDomainInterface,
  PaginationResultDomainInterface,
} from '~/domain/common/interfaces/pagination.interface';
import type { InvestFilterInputDTO } from '../../application/dto/invests_management/invest-filter.input';
import { PaginationUtils } from '~/shared/utils/pagination.utils';

@Injectable()
export class InvestTypeormRepository
  extends BaseBlockchainRepository<InvestDomainEntity, InvestTypeormEntity>
  implements InvestRepository, IBlockchainSyncRepository<InvestDomainEntity>
{
  constructor(
    @InjectRepository(InvestTypeormEntity, CAPITAL_DATABASE_CONNECTION)
    repository: Repository<InvestTypeormEntity>,
    entityVersioningService: EntityVersioningService
  ) {
    super(repository, entityVersioningService);
  }

  protected getMapper() {
    return {
      toDomain: InvestMapper.toDomain,
      toEntity: InvestMapper.toEntity,
    };
  }

  protected createDomainEntity(
    databaseData: IInvestDatabaseData,
    blockchainData: IInvestBlockchainData
  ): InvestDomainEntity {
    return new InvestDomainEntity(databaseData, blockchainData);
  }

  protected getSyncKey(): string {
    return InvestDomainEntity.getSyncKey();
  }

  async create(invest: InvestDomainEntity): Promise<InvestDomainEntity> {
    const entity = this.repository.create(InvestMapper.toEntity(invest));
    const savedEntity = await this.repository.save(entity);
    return InvestMapper.toDomain(savedEntity);
  }

  async findByUsername(username: string): Promise<InvestDomainEntity[]> {
    const entities = await this.repository.find({ where: { username } });
    return entities.map((entity) => InvestMapper.toDomain(entity));
  }

  async findByProjectHash(projectHash: string): Promise<InvestDomainEntity[]> {
    const entities = await this.repository.find({ where: { project_hash: projectHash } });
    return entities.map((entity) => InvestMapper.toDomain(entity));
  }

  async findByStatus(status: string): Promise<InvestDomainEntity[]> {
    const entities = await this.repository.find({ where: { status: status as any } });
    return entities.map((entity) => InvestMapper.toDomain(entity));
  }

  async findAllPaginated(
    filter?: InvestFilterInputDTO,
    options?: PaginationInputDomainInterface
  ): Promise<PaginationResultDomainInterface<InvestDomainEntity>> {
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
    const items = entities.map((entity) => InvestMapper.toDomain(entity));

    // Возвращаем результат с пагинацией
    return PaginationUtils.createPaginationResult(items, totalCount, validatedOptions);
  }
}
