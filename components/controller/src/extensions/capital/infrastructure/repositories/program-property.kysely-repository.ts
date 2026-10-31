import { CAPITAL_PROGRAM_PROPERTY_STORE } from '../database/capital-stores';
import { PaginationInputDTO, PaginationResult, PaginationUtils, type TableStore } from '@coopenomics/extension-kit';
import { Inject, Injectable } from '@nestjs/common';
import { ProgramPropertyDomainEntity } from '../../domain/entities/program-property.entity';
import { ProgramPropertyRecord } from '../entities/program-property.record';
import { ProgramPropertyMapper } from '../mappers/program-property.mapper';
import type { ProgramPropertyRepository } from '../../domain/repositories/program-property.repository';
import { BaseChainRepository, ChainVersioningService } from '@coopenomics/extension-kit/sync';
import type { IProgramPropertyDatabaseData } from '../../domain/interfaces/program-property-database.interface';
import type { IProgramPropertyBlockchainData } from '../../domain/interfaces/program-property-blockchain.interface';
import type { ProgramPropertyFilterInputDTO } from '../../application/dto/property_management/program-property-filter.input';

/**
 * Хранилище программных имущественных взносов
 */
@Injectable()
export class ProgramPropertyKyselyRepository
  extends BaseChainRepository<ProgramPropertyDomainEntity, ProgramPropertyRecord>
  implements ProgramPropertyRepository
{
  constructor(
    @Inject(CAPITAL_PROGRAM_PROPERTY_STORE) repository: TableStore<ProgramPropertyRecord>,
    @Inject(ChainVersioningService) versioning: ChainVersioningService
  ) {
    super(repository, versioning);
  }

  protected getMapper() {
    return {
      toDomain: ProgramPropertyMapper.toDomain,
      toEntity: ProgramPropertyMapper.toEntity,
    };
  }


  protected createDomainEntity(
    databaseData: IProgramPropertyDatabaseData,
    blockchainData: IProgramPropertyBlockchainData
  ): ProgramPropertyDomainEntity {
    return new ProgramPropertyDomainEntity(databaseData, blockchainData);
  }

  protected getSyncKey(): string {
    return ProgramPropertyDomainEntity.getSyncKey();
  }

  async findAllPaginated(
    filter?: ProgramPropertyFilterInputDTO,
    options?: PaginationInputDTO
  ): Promise<PaginationResult<ProgramPropertyDomainEntity>> {
    const validatedOptions: PaginationInputDTO = options
      ? PaginationUtils.validatePaginationOptions(options)
      : { page: 1, limit: 10, sortBy: undefined, sortOrder: 'DESC' as const };
    const { limit, offset } = PaginationUtils.getSqlPaginationParams(validatedOptions);

    // Удалённые в цепи записи отдаются: после приёма или отказа строки в цепи
    // нет, а пайщику нужна история своих взносов.
    const where: any = {};
    if (filter?.username) where.username = filter.username;
    if (filter?.status) where.status = filter.status;

    const totalCount = await this.repository.count(where);

    // Имя вне колонок — сортировка по умолчанию, а не ошибка в ORDER BY.
    const sortColumn = this.repository.sortField(validatedOptions.sortBy, '_created_at');
    const orderBy: any = {};
    orderBy[sortColumn] = sortColumn === validatedOptions.sortBy ? validatedOptions.sortOrder : 'DESC';
    const records = await this.repository.find(where, { order: orderBy, limit, offset });

    return PaginationUtils.createPaginationResult(
      records.map((record) => ProgramPropertyMapper.toDomain(record)),
      totalCount,
      validatedOptions
    );
  }

  async findByStepHash(hash: string): Promise<ProgramPropertyDomainEntity | null> {
    const record = await this.repository
      .sqlBuilder('p')
      .where("LOWER(p.property_hash) = :hash OR LOWER(p.statement->>'hash') = :hash OR LOWER(p.act->>'hash') = :hash", {
        hash: hash.toLowerCase(),
      })
      .getOne();
    return record ? ProgramPropertyMapper.toDomain(record) : null;
  }
}
