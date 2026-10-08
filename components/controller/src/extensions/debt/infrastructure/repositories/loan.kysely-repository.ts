import { Inject, Injectable } from '@nestjs/common';
import { oneOf, within, type PaginationInputDTO, type TableStore } from '@coopenomics/extension-kit';
import { BaseChainRepository, ChainVersioningService } from '@coopenomics/extension-kit/sync';
import type { IBlockchainSyncRepository } from '@coopenomics/extension-kit/sync';
import { DEBT_LOAN_STORE } from '../database/debt-stores';
import { LoanDomainEntity } from '../../domain/entities/loan.entity';
import { LoanRecord } from '../entities/loan.record';
import { LoanMapper } from '../mappers/loan.mapper';
import type { LoanListFilter, LoanRepository } from '../../domain/repositories/loan.repository';
import type { ILoanDatabaseData } from '../../domain/interfaces/loan-database.interface';
import type { ILoanBlockchainData } from '../../domain/interfaces/loan-blockchain.interface';
import { LoanStatus } from '../../domain/enums/loan-status.enum';

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class LoanKyselyRepository
  extends BaseChainRepository<LoanDomainEntity, LoanRecord>
  implements LoanRepository, IBlockchainSyncRepository<LoanDomainEntity>
{
  constructor(
    @Inject(DEBT_LOAN_STORE) repository: TableStore<LoanRecord>,
    @Inject(ChainVersioningService) versioning: ChainVersioningService
  ) {
    super(repository, versioning);
  }

  protected getMapper() {
    return { toDomain: LoanMapper.toDomain, toEntity: LoanMapper.toEntity };
  }

  protected createDomainEntity(databaseData: ILoanDatabaseData, blockchainData: ILoanBlockchainData): LoanDomainEntity {
    return new LoanDomainEntity(databaseData, blockchainData);
  }

  protected getSyncKey(): string {
    return LoanDomainEntity.getSyncKey();
  }

  async create(loan: LoanDomainEntity): Promise<LoanDomainEntity> {
    const entity = this.repository.create(LoanMapper.toEntity(loan));
    const saved = await this.repository.save(entity);
    return LoanMapper.toDomain(saved);
  }

  async findByDebtHash(debtHash: string): Promise<LoanDomainEntity | null> {
    const entity = await this.repository.findOne({ debt_hash: debtHash.toLowerCase() });
    return entity ? LoanMapper.toDomain(entity) : null;
  }

  async findByUsername(coopname: string, username: string): Promise<LoanDomainEntity[]> {
    const entities = await this.repository.find({ coopname, username });
    return entities.map((e) => LoanMapper.toDomain(e));
  }

  async findByStatus(coopname: string, status: LoanStatus): Promise<LoanDomainEntity[]> {
    const entities = await this.repository.find({ coopname, status });
    return entities.map((e) => LoanMapper.toDomain(e));
  }

  /** Условие отбора по фильтру списка. */
  private whereOf(filter: LoanListFilter): Record<string, unknown> {
    const where: Record<string, unknown> = { coopname: filter.coopname };
    if (filter.username) where.username = filter.username;
    if (filter.status) where.status = filter.status;
    if (filter.source) where.source = filter.source;
    if (filter.outstanding) where.status = oneOf([LoanStatus.ISSUED, LoanStatus.OVERDUE]);
    if (filter.due_within_days && filter.due_within_days > 0) {
      const now = new Date();
      where.status = LoanStatus.ISSUED;
      where.due_at = within(now, new Date(now.getTime() + filter.due_within_days * DAY_MS));
    }
    return where;
  }

  async findPaginated(
    filter: LoanListFilter,
    options?: PaginationInputDTO
  ): Promise<{ items: LoanDomainEntity[]; totalCount: number }> {
    const where = this.whereOf(filter);

    const page = Math.max(1, options?.page ?? 1);
    const limit = Math.max(1, Math.min(200, options?.limit ?? 10));
    // Имя вне колонок и пустое имя — сортировка по умолчанию (C28-80).
    const sortBy = this.repository.sortField(options?.sortBy, '_created_at');
    const sortOrder = sortBy === options?.sortBy && options?.sortOrder === 'ASC' ? 'ASC' : 'DESC';

    const [entities, totalCount] = await this.repository.findAndCount(where, {
      order: { [sortBy]: sortOrder },
      limit,
      offset: (page - 1) * limit,
    });
    return { items: entities.map((e) => LoanMapper.toDomain(e)), totalCount };
  }
}
