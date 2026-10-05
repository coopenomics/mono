import { CAPITAL_INVEST_STORE } from '../database/capital-stores';
import { PaginationInputDTO, PaginationResult, PaginationUtils, type TableStore } from '@coopenomics/extension-kit';
import { Inject, Injectable } from '@nestjs/common';
import { InvestRepository } from '../../domain/repositories/invest.repository';
import { InvestDomainEntity } from '../../domain/entities/invest.entity';
import { InvestTypeormEntity } from '../entities/invest.typeorm-entity';
import { InvestMapper } from '../mappers/invest.mapper';
import { BaseChainRepository, ChainVersioningService, type IBlockchainSyncRepository } from '@coopenomics/extension-kit/sync';
import type { IInvestDatabaseData } from '../../domain/interfaces/invest-database.interface';
import type { IInvestBlockchainData } from '../../domain/interfaces/invest-blockchain.interface';
import type { InvestFilterInputDTO } from '../../application/dto/invests_management/invest-filter.input';

@Injectable()
export class InvestTypeormRepository
  extends BaseChainRepository<InvestDomainEntity, InvestTypeormEntity>
  implements InvestRepository, IBlockchainSyncRepository<InvestDomainEntity>
{
  constructor(
    @Inject(CAPITAL_INVEST_STORE) repository: TableStore<InvestTypeormEntity>,
    @Inject(ChainVersioningService) versioning: ChainVersioningService
  ) {
    super(repository, versioning);
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
    const entities = await this.repository.find({ username });
    return entities.map((entity) => InvestMapper.toDomain(entity));
  }

  async findByProjectHash(projectHash: string): Promise<InvestDomainEntity[]> {
    const entities = await this.repository.find({ project_hash: projectHash });
    return entities.map((entity) => InvestMapper.toDomain(entity));
  }

  async findByStatus(status: string): Promise<InvestDomainEntity[]> {
    const entities = await this.repository.find({ status: status as any });
    return entities.map((entity) => InvestMapper.toDomain(entity));
  }

  async findAllPaginated(
    filter?: InvestFilterInputDTO,
    options?: PaginationInputDTO
  ): Promise<PaginationResult<InvestDomainEntity>> {
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

    // Строим условия поиска
    const where: any = {};
    if (filter?.username) {
      where.username = filter.username;
    }
    if (filter?.status) {
      where.status = filter.status;
    }

    // Получаем общее количество записей
    const totalCount = await this.repository.count(where);

    // Получаем записи с пагинацией
    const orderBy: any = {};
    // Имя вне колонок — сортировка по умолчанию: до 25.09.2026 оно уходило в
    // ORDER BY и роняло список ошибкой 500 (C28-80).
    const sortColumn = this.repository.sortField(validatedOptions.sortBy, 'created_at');
    orderBy[sortColumn] = sortColumn === validatedOptions.sortBy ? validatedOptions.sortOrder : 'DESC';

    const entities = await this.repository.find(where, { order: orderBy, limit: limit, offset: offset });

    // Преобразуем в доменные сущности
    const items = entities.map((entity) => InvestMapper.toDomain(entity));

    // Возвращаем результат с пагинацией
    return PaginationUtils.createPaginationResult(items, totalCount, validatedOptions);
  }
}
