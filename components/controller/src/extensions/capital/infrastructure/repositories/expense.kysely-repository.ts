import { CAPITAL_EXPENSE_STORE } from '../database/capital-stores';
import { PaginationInputDTO, PaginationResult, PaginationUtils, type TableStore } from '@coopenomics/extension-kit';
import { Inject, Injectable } from '@nestjs/common';
import { ExpenseRepository } from '../../domain/repositories/expense.repository';
import { ExpenseDomainEntity } from '../../domain/entities/expense.entity';
import { ExpenseRecord } from '../entities/expense.record';
import { ExpenseMapper } from '../mappers/expense.mapper';
import { BaseChainRepository, ChainVersioningService, type IBlockchainSyncRepository } from '@coopenomics/extension-kit/sync';
import type { IExpenseBlockchainData } from '../../domain/interfaces/expense-blockchain.interface';
import type { IExpenseDatabaseData } from '../../domain/interfaces/expense-database.interface';
import type { ExpenseFilterInputDTO } from '../../application/dto/expenses_management/expense-filter.input';

@Injectable()
export class ExpenseKyselyRepository
  extends BaseChainRepository<ExpenseDomainEntity, ExpenseRecord>
  implements ExpenseRepository, IBlockchainSyncRepository<ExpenseDomainEntity>
{
  constructor(
    @Inject(CAPITAL_EXPENSE_STORE) repository: TableStore<ExpenseRecord>,
    @Inject(ChainVersioningService) versioning: ChainVersioningService
  ) {
    super(repository, versioning);
  }

  protected getMapper() {
    return {
      toDomain: ExpenseMapper.toDomain,
      toEntity: ExpenseMapper.toEntity,
    };
  }


  protected createDomainEntity(
    databaseData: IExpenseDatabaseData,
    blockchainData: IExpenseBlockchainData
  ): ExpenseDomainEntity {
    return new ExpenseDomainEntity(databaseData, blockchainData);
  }

  protected getSyncKey(): string {
    return ExpenseDomainEntity.getSyncKey();
  }

  async create(expense: ExpenseDomainEntity): Promise<ExpenseDomainEntity> {
    const entity = this.repository.create(ExpenseMapper.toEntity(expense));
    const savedEntity = await this.repository.save(entity);
    return ExpenseMapper.toDomain(savedEntity);
  }

  async findByUsername(username: string): Promise<ExpenseDomainEntity[]> {
    const entities = await this.repository.find({ username });
    return entities.map((entity) => ExpenseMapper.toDomain(entity));
  }

  async findByProjectHash(projectHash: string): Promise<ExpenseDomainEntity[]> {
    const entities = await this.repository.find({ project_hash: projectHash });
    return entities.map((entity) => ExpenseMapper.toDomain(entity));
  }

  async findByStatus(status: string): Promise<ExpenseDomainEntity[]> {
    const entities = await this.repository.find({ status: status as any });
    return entities.map((entity) => ExpenseMapper.toDomain(entity));
  }

  async findAllPaginated(
    filter?: ExpenseFilterInputDTO,
    options?: PaginationInputDTO
  ): Promise<PaginationResult<ExpenseDomainEntity>> {
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
    if (filter?.projectHash) {
      where.project_hash = filter.projectHash;
    }
    if (filter?.status) {
      where.status = filter.status;
    }
    if (filter?.fundId) {
      where.fund_id = filter.fundId;
    }

    // Строим параметры сортировки
    const order: any = {};
    // Имя вне колонок — сортировка по умолчанию: до 25.09.2026 оно уходило в
    // ORDER BY и роняло список ошибкой 500 (C28-80).
    const sortColumn = this.repository.sortField(validatedOptions.sortBy, 'created_at');
    order[sortColumn] = sortColumn === validatedOptions.sortBy ? validatedOptions.sortOrder : 'DESC';

    // Выполняем запрос с пагинацией
    const [entities, total] = await this.repository.findAndCount(where, { order: order, limit: limit, offset: offset });

    // Конвертируем в доменные сущности
    const items = entities.map((entity) => ExpenseMapper.toDomain(entity));

    // Возвращаем результат с пагинацией
    return PaginationUtils.createPaginationResult(items, total, validatedOptions);
  }
}
