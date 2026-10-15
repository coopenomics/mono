import { EXPENSES_PROPOSAL_STORE } from '../database/expenses-stores';
import { type PaginationInputDTO, type TableStore } from '@coopenomics/extension-kit';
import { Inject, Injectable } from '@nestjs/common';
import { BaseChainRepository, ChainVersioningService } from '@coopenomics/extension-kit/sync';
import type { IBlockchainSyncRepository } from '@coopenomics/extension-kit/sync';
import { ExpenseProposalDomainEntity } from '../../domain/entities/expense-proposal.entity';
import { ExpenseProposalRecord } from '../entities/expense-proposal.record';
import { ExpenseProposalMapper } from '../mappers/expense-proposal.mapper';
import type { ExpenseProposalRepository } from '../../domain/repositories/expense-proposal.repository';
import type { IExpenseProposalDatabaseData } from '../../domain/interfaces/expense-proposal-database.interface';
import type { IExpenseProposalBlockchainData } from '../../domain/interfaces/expense-proposal-blockchain.interface';

@Injectable()
export class ExpenseProposalKyselyRepository
  extends BaseChainRepository<ExpenseProposalDomainEntity, ExpenseProposalRecord>
  implements ExpenseProposalRepository, IBlockchainSyncRepository<ExpenseProposalDomainEntity>
{
  constructor(
    @Inject(EXPENSES_PROPOSAL_STORE) repository: TableStore<ExpenseProposalRecord>,
    @Inject(ChainVersioningService) versioning: ChainVersioningService
  ) {
    super(repository, versioning);
  }

  protected getMapper() {
    return {
      toDomain: ExpenseProposalMapper.toDomain,
      toEntity: ExpenseProposalMapper.toEntity,
    };
  }

  protected createDomainEntity(
    databaseData: IExpenseProposalDatabaseData,
    blockchainData: IExpenseProposalBlockchainData
  ): ExpenseProposalDomainEntity {
    return new ExpenseProposalDomainEntity(databaseData, blockchainData);
  }

  protected getSyncKey(): string {
    return ExpenseProposalDomainEntity.getSyncKey();
  }

  async create(proposal: ExpenseProposalDomainEntity): Promise<ExpenseProposalDomainEntity> {
    const entity = this.repository.create(ExpenseProposalMapper.toEntity(proposal));
    const saved = await this.repository.save(entity);
    return ExpenseProposalMapper.toDomain(saved);
  }

  async findByProposalHash(proposalHash: string): Promise<ExpenseProposalDomainEntity | null> {
    const entity = await this.repository.findOne({ proposal_hash: proposalHash.toLowerCase() });
    return entity ? ExpenseProposalMapper.toDomain(entity) : null;
  }

  async findByCoopname(coopname: string): Promise<ExpenseProposalDomainEntity[]> {
    const entities = await this.repository.find({ coopname });
    return entities.map((e) => ExpenseProposalMapper.toDomain(e));
  }

  async findByUsername(coopname: string, username: string): Promise<ExpenseProposalDomainEntity[]> {
    const entities = await this.repository.find({ coopname, username });
    return entities.map((e) => ExpenseProposalMapper.toDomain(e));
  }

  async findByCoopnamePaginated(
    coopname: string,
    options?: PaginationInputDTO
  ): Promise<{ items: ExpenseProposalDomainEntity[]; totalCount: number }> {
    return this.paginate({ coopname }, options);
  }

  async findByUsernamePaginated(
    coopname: string,
    username: string,
    options?: PaginationInputDTO
  ): Promise<{ items: ExpenseProposalDomainEntity[]; totalCount: number }> {
    return this.paginate({ coopname, username }, options);
  }

  private async paginate(
    where: Record<string, unknown>,
    options?: PaginationInputDTO
  ): Promise<{ items: ExpenseProposalDomainEntity[]; totalCount: number }> {
    const page = Math.max(1, options?.page ?? 1);
    const limit = Math.max(1, Math.min(200, options?.limit ?? 10));
    // Имя вне колонок и пустое имя — сортировка по умолчанию: до 25.09.2026 они
    // уходили в ORDER BY и роняли список ошибкой 500 (C28-80).
    const sortBy = this.repository.sortField(options?.sortBy, '_created_at');
    const sortOrder = sortBy === options?.sortBy && options?.sortOrder === 'ASC' ? 'ASC' : 'DESC';

    const [entities, totalCount] = await this.repository.findAndCount(where, { order: { [sortBy]: sortOrder }, limit: limit, offset: (page - 1) * limit });
    return {
      items: entities.map((e) => ExpenseProposalMapper.toDomain(e)),
      totalCount,
    };
  }
}
