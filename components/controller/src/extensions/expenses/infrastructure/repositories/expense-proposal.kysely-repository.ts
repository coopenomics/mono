import { EXPENSES_PROPOSAL_STORE } from '../database/expenses-stores';
import { type PaginationInputDTO, type TableStore } from '@coopenomics/extension-kit';
import { Inject, Injectable } from '@nestjs/common';
import { BaseChainRepository, ChainVersioningService } from '@coopenomics/extension-kit/sync';
import type { IBlockchainSyncRepository } from '@coopenomics/extension-kit/sync';
import { ExpenseProposalDomainEntity } from '../../domain/entities/expense-proposal.entity';
import { ExpenseProposalRecord } from '../entities/expense-proposal.record';
import { ExpenseProposalMapper } from '../mappers/expense-proposal.mapper';
import type {
  ExpenseProposalRepository,
  IExpenseAdvanceQuery,
  IExpenseAdvanceRow,
} from '../../domain/repositories/expense-proposal.repository';
import type { IExpenseProposalDatabaseData } from '../../domain/interfaces/expense-proposal-database.interface';
import type { IExpenseProposalBlockchainData } from '../../domain/interfaces/expense-proposal-blockchain.interface';
import { ExpenseChainMechanics } from '../../domain/enums/expense-mechanics.enum';

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

  /**
   * Строки записки лежат одним json-массивом `items`: массив разворачивается в
   * строки, и одна строка ответа — один аванс. Строки оплаты по счёту авансом
   * не считаются. Порядок — новые записки сверху, внутри записки — по хешу строки.
   */
  async findAdvances(
    coopname: string,
    query: IExpenseAdvanceQuery,
    options?: PaginationInputDTO
  ): Promise<{ items: IExpenseAdvanceRow[]; totalCount: number }> {
    const { limit, offset } = this.pageOf(options);
    const rows = await this.advancesOf(coopname, query)
      .select('p.proposal_hash', 'proposal_hash')
      .addSelect('i.value', 'item')
      .orderBy('p.created_at', 'DESC')
      .addOrderBy("i.value->>'item_hash'", 'ASC')
      .limit(limit)
      .offset(offset)
      .getRawMany<IExpenseAdvanceRow>();
    const total = await this.advancesOf(coopname, query).select('COUNT(*)', 'count').getRawOne<{ count: string }>();
    return { items: rows, totalCount: Number(total?.count ?? 0) };
  }

  private advancesOf(coopname: string, query: IExpenseAdvanceQuery) {
    const builder = this.repository
      .sqlBuilder('p')
      .innerJoin('jsonb_array_elements(p.items)', 'i', 'true')
      .where('p.coopname = :coopname', { coopname })
      .andWhere("CAST(i.value->>'mechanics' AS integer) = :advance", { advance: ExpenseChainMechanics.ADVANCE })
      .andWhere("CAST(i.value->>'status' AS integer) IN (:...statuses)", { statuses: query.statuses });
    if (query.onlyItems) builder.andWhere("LOWER(i.value->>'item_hash') IN (:...onlyItems)", { onlyItems: query.onlyItems });
    // Пустой перечень исключений не пишется: NOT IN (NULL) отсёк бы все строки.
    if (query.exceptItems?.length) {
      builder.andWhere("LOWER(i.value->>'item_hash') NOT IN (:...exceptItems)", { exceptItems: query.exceptItems });
    }
    return builder;
  }

  private async paginate(
    where: Record<string, unknown>,
    options?: PaginationInputDTO
  ): Promise<{ items: ExpenseProposalDomainEntity[]; totalCount: number }> {
    const { limit, offset, sortBy, sortOrder } = this.pageOf(options);
    const [entities, totalCount] = await this.repository.findAndCount(where, { order: { [sortBy]: sortOrder }, limit, offset });
    return {
      items: entities.map((e) => ExpenseProposalMapper.toDomain(e)),
      totalCount,
    };
  }

  private pageOf(options?: PaginationInputDTO): {
    limit: number;
    offset: number;
    sortBy: keyof ExpenseProposalRecord & string;
    sortOrder: 'ASC' | 'DESC';
  } {
    const page = Math.max(1, options?.page ?? 1);
    const limit = Math.max(1, Math.min(200, options?.limit ?? 10));
    // Имя вне колонок и пустое имя — сортировка по умолчанию: до 25.09.2026 они
    // уходили в ORDER BY и роняли список ошибкой 500 (C28-80).
    const sortBy = this.repository.sortField(options?.sortBy, '_created_at');
    const sortOrder = sortBy === options?.sortBy && options?.sortOrder === 'ASC' ? 'ASC' : 'DESC';
    return { limit, offset: (page - 1) * limit, sortBy, sortOrder };
  }
}
