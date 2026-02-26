import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExpenseRepository } from '../../domain/repositories/expense.repository';
import { ExpenseDomainEntity } from '../../domain/entities/expense.entity';
import { ExpenseTypeormEntity } from '../entities/expense.typeorm-entity';
import { ExpenseMapper } from '../mappers/expense.mapper';
import { CAPITAL_DATABASE_CONNECTION } from '../database/capital-database.module';
import type { IBlockchainSyncRepository } from '~/shared/interfaces/blockchain-sync.interface';
import { BaseBlockchainRepository } from '~/shared/sync/repositories/base-blockchain.repository';
import { EntityVersioningService } from '~/shared/sync/services/entity-versioning.service';
import type { IExpenseBlockchainData } from '../../domain/interfaces/expense-blockchain.interface';
import type { IExpenseDatabaseData } from '../../domain/interfaces/expense-database.interface';
import type { ExpenseFilterInputDTO } from '../../application/dto/expenses_management/expense-filter.input';
import type {
  PaginationInputDomainInterface,
  PaginationResultDomainInterface,
} from '~/domain/common/interfaces/pagination.interface';
import { PaginationUtils } from '~/shared/utils/pagination.utils';

@Injectable()
export class ExpenseTypeormRepository
  extends BaseBlockchainRepository<ExpenseDomainEntity, ExpenseTypeormEntity>
  implements ExpenseRepository, IBlockchainSyncRepository<ExpenseDomainEntity>
{
  constructor(
    @InjectRepository(ExpenseTypeormEntity, CAPITAL_DATABASE_CONNECTION)
    repository: Repository<ExpenseTypeormEntity>,
    entityVersioningService: EntityVersioningService
  ) {
    super(repository, entityVersioningService);
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
    const entities = await this.repository.find({ where: { username } });
    return entities.map((entity) => ExpenseMapper.toDomain(entity));
  }

  async findByProjectHash(projectHash: string): Promise<ExpenseDomainEntity[]> {
    const entities = await this.repository.find({ where: { project_hash: projectHash } });
    return entities.map((entity) => ExpenseMapper.toDomain(entity));
  }

  async findByStatus(status: string): Promise<ExpenseDomainEntity[]> {
    const entities = await this.repository.find({ where: { status: status as any } });
    return entities.map((entity) => ExpenseMapper.toDomain(entity));
  }

  async findAllPaginated(
    filter?: ExpenseFilterInputDTO,
    options?: PaginationInputDomainInterface
  ): Promise<PaginationResultDomainInterface<ExpenseDomainEntity>> {
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
    if (validatedOptions.sortBy) {
      order[validatedOptions.sortBy] = validatedOptions.sortOrder;
    } else {
      order.created_at = 'DESC';
    }

    // Выполняем запрос с пагинацией
    const [entities, total] = await this.repository.findAndCount({
      where,
      order,
      skip: offset,
      take: limit,
    });

    // Конвертируем в доменные сущности
    const items = entities.map((entity) => ExpenseMapper.toDomain(entity));

    // Возвращаем результат с пагинацией
    return PaginationUtils.createPaginationResult(items, total, validatedOptions);
  }
}
