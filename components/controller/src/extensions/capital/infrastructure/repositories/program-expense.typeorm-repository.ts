import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProgramExpenseRepository } from '../../domain/repositories/program-expense.repository';
import { ProgramExpenseDomainEntity } from '../../domain/entities/program-expense.entity';
import { ProgramExpenseTypeormEntity } from '../entities/program-expense.typeorm-entity';
import { ProgramExpenseMapper } from '../mappers/program-expense.mapper';
import type { IBlockchainSyncRepository } from '~/shared/interfaces/blockchain-sync.interface';
import { BaseBlockchainRepository } from '~/shared/sync/repositories/base-blockchain.repository';
import { EntityVersioningService } from '~/shared/sync/services/entity-versioning.service';
import type { IProgramExpenseBlockchainData } from '../../domain/interfaces/program-expense-blockchain.interface';
import type { IProgramExpenseDatabaseData } from '../../domain/interfaces/program-expense-database.interface';
import type { ProgramExpenseFilterInputDTO } from '../../application/dto/program_expenses_management/program-expense-filter.input';
import type {
  PaginationInputDomainInterface,
  PaginationResultDomainInterface,
} from '~/domain/common/interfaces/pagination.interface';
import { PaginationUtils } from '~/shared/utils/pagination.utils';

@Injectable()
export class ProgramExpenseTypeormRepository
  extends BaseBlockchainRepository<ProgramExpenseDomainEntity, ProgramExpenseTypeormEntity>
  implements ProgramExpenseRepository, IBlockchainSyncRepository<ProgramExpenseDomainEntity>
{
  constructor(
    @InjectRepository(ProgramExpenseTypeormEntity)
    repository: Repository<ProgramExpenseTypeormEntity>,
    entityVersioningService: EntityVersioningService,
  ) {
    super(repository, entityVersioningService);
  }

  protected getMapper() {
    return {
      toDomain: ProgramExpenseMapper.toDomain,
      toEntity: ProgramExpenseMapper.toEntity,
    };
  }

  protected createDomainEntity(
    databaseData: IProgramExpenseDatabaseData,
    blockchainData: IProgramExpenseBlockchainData,
  ): ProgramExpenseDomainEntity {
    return new ProgramExpenseDomainEntity(databaseData, blockchainData);
  }

  protected getSyncKey(): string {
    return ProgramExpenseDomainEntity.getSyncKey();
  }

  async create(expense: ProgramExpenseDomainEntity): Promise<ProgramExpenseDomainEntity> {
    const entity = this.repository.create(ProgramExpenseMapper.toEntity(expense));
    const savedEntity = await this.repository.save(entity);
    return ProgramExpenseMapper.toDomain(savedEntity);
  }

  async findByUsername(username: string): Promise<ProgramExpenseDomainEntity[]> {
    const entities = await this.repository.find({ where: { username } });
    return entities.map((entity) => ProgramExpenseMapper.toDomain(entity));
  }

  async findByStatus(status: string): Promise<ProgramExpenseDomainEntity[]> {
    const entities = await this.repository.find({ where: { status: status as any } });
    return entities.map((entity) => ProgramExpenseMapper.toDomain(entity));
  }

  async findAllPaginated(
    filter?: ProgramExpenseFilterInputDTO,
    options?: PaginationInputDomainInterface,
  ): Promise<PaginationResultDomainInterface<ProgramExpenseDomainEntity>> {
    const validatedOptions: PaginationInputDomainInterface = options
      ? PaginationUtils.validatePaginationOptions(options)
      : {
          page: 1,
          limit: 10,
          sortBy: undefined,
          sortOrder: 'ASC' as const,
        };

    const { limit, offset } = PaginationUtils.getSqlPaginationParams(validatedOptions);

    const where: any = {};
    if (filter?.username) {
      where.username = filter.username;
    }
    if (filter?.status) {
      where.status = filter.status;
    }
    if (filter?.fundId) {
      where.fund_id = filter.fundId;
    }

    const order: any = {};
    if (validatedOptions.sortBy) {
      order[validatedOptions.sortBy] = validatedOptions.sortOrder;
    } else {
      order.created_at = 'DESC';
    }

    const [entities, total] = await this.repository.findAndCount({
      where,
      order,
      skip: offset,
      take: limit,
    });

    const items = entities.map((entity) => ProgramExpenseMapper.toDomain(entity));

    return PaginationUtils.createPaginationResult(items, total, validatedOptions);
  }
}
