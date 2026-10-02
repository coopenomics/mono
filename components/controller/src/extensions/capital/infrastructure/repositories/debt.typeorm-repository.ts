import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DebtRepository } from '../../domain/repositories/debt.repository';
import { DebtDomainEntity } from '../../domain/entities/debt.entity';
import { DebtTypeormEntity } from '../entities/debt.typeorm-entity';
import { DebtMapper } from '../mappers/debt.mapper';
import type { IBlockchainSyncRepository } from '@coopenomics/extension-kit/sync';
import { BaseBlockchainRepository, EntityVersioningService } from '@coopenomics/extension-kit/sync';
import type { IDebtDatabaseData } from '../../domain/interfaces/debt-database.interface';
import type { IDebtBlockchainData } from '../../domain/interfaces/debt-blockchain.interface';
import type { DebtFilterInputDTO } from '../../application/dto/debt_management/debt-filter.input';
import { PaginationInputDTO, PaginationResult, PaginationUtils, resolveSortColumn } from '@coopenomics/extension-kit';

@Injectable()
export class DebtTypeormRepository
  extends BaseBlockchainRepository<DebtDomainEntity, DebtTypeormEntity>
  implements DebtRepository, IBlockchainSyncRepository<DebtDomainEntity>
{
  constructor(
    @InjectRepository(DebtTypeormEntity)
    repository: Repository<DebtTypeormEntity>,
    entityVersioningService: EntityVersioningService
  ) {
    super(repository, entityVersioningService);
  }

  protected getMapper() {
    return {
      toDomain: DebtMapper.toDomain,
      toEntity: DebtMapper.toEntity,
    };
  }


  protected createDomainEntity(databaseData: IDebtDatabaseData, blockchainData: IDebtBlockchainData): DebtDomainEntity {
    return new DebtDomainEntity(databaseData, blockchainData);
  }

  protected getSyncKey(): string {
    return DebtDomainEntity.getSyncKey();
  }

  async create(debt: DebtDomainEntity): Promise<DebtDomainEntity> {
    const entity = this.repository.create(DebtMapper.toEntity(debt));
    const savedEntity = await this.repository.save(entity);
    return DebtMapper.toDomain(savedEntity);
  }

  async findByUsername(username: string): Promise<DebtDomainEntity[]> {
    const entities = await this.repository.find({ where: { username } });
    return entities.map((entity) => DebtMapper.toDomain(entity));
  }

  async findByProjectHash(projectHash: string): Promise<DebtDomainEntity[]> {
    const entities = await this.repository.find({ where: { project_hash: projectHash } });
    return entities.map((entity) => DebtMapper.toDomain(entity));
  }

  async findByStatus(status: string): Promise<DebtDomainEntity[]> {
    const entities = await this.repository.find({ where: { status: status as any } });
    return entities.map((entity) => DebtMapper.toDomain(entity));
  }

  async findAllPaginated(
    filter?: DebtFilterInputDTO,
    options?: PaginationInputDTO
  ): Promise<PaginationResult<DebtDomainEntity>> {
    const validatedOptions: PaginationInputDTO = options
      ? PaginationUtils.validatePaginationOptions(options)
      : { page: 1, limit: 10, sortBy: undefined, sortOrder: 'ASC' as const };
    const { limit, offset } = PaginationUtils.getSqlPaginationParams(validatedOptions);

    const where: any = {};
    if (filter?.username) where.username = filter.username;
    if (filter?.projectHash) where.project_hash = filter.projectHash.toLowerCase();
    if (filter?.status) where.status = filter.status;

    const totalCount = await this.repository.count({ where });

    // Имя вне колонок — сортировка по умолчанию, а не ошибка в ORDER BY.
    const sortColumn = resolveSortColumn(this.repository, validatedOptions.sortBy, '_created_at');
    const orderBy: any = {};
    orderBy[sortColumn] = sortColumn === validatedOptions.sortBy ? validatedOptions.sortOrder : 'DESC';
    const entities = await this.repository.find({ where, skip: offset, take: limit, order: orderBy });

    return PaginationUtils.createPaginationResult(
      entities.map((entity) => DebtMapper.toDomain(entity)),
      totalCount,
      validatedOptions
    );
  }
}
