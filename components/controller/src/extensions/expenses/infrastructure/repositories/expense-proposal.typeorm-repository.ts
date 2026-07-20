import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseBlockchainRepository } from '~/shared/sync/repositories/base-blockchain.repository';
import { EntityVersioningService } from '~/shared/sync/services/entity-versioning.service';
import type { IBlockchainSyncRepository } from '~/shared/interfaces/blockchain-sync.interface';
import type { PaginationInputDTO } from '~/application/common/dto/pagination.dto';
import { ExpenseProposalDomainEntity } from '../../domain/entities/expense-proposal.entity';
import { ExpenseProposalTypeormEntity } from '../entities/expense-proposal.typeorm-entity';
import { ExpenseProposalMapper } from '../mappers/expense-proposal.mapper';
import type { ExpenseProposalRepository } from '../../domain/repositories/expense-proposal.repository';
import type { IExpenseProposalDatabaseData } from '../../domain/interfaces/expense-proposal-database.interface';
import type { IExpenseProposalBlockchainData } from '../../domain/interfaces/expense-proposal-blockchain.interface';

@Injectable()
export class ExpenseProposalTypeormRepository
  extends BaseBlockchainRepository<ExpenseProposalDomainEntity, ExpenseProposalTypeormEntity>
  implements ExpenseProposalRepository, IBlockchainSyncRepository<ExpenseProposalDomainEntity>
{
  constructor(
    @InjectRepository(ExpenseProposalTypeormEntity)
    repository: Repository<ExpenseProposalTypeormEntity>,
    entityVersioningService: EntityVersioningService
  ) {
    super(repository, entityVersioningService);
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
    const entity = await this.repository.findOne({ where: { proposal_hash: proposalHash.toLowerCase() } });
    return entity ? ExpenseProposalMapper.toDomain(entity) : null;
  }

  async findByCoopname(coopname: string): Promise<ExpenseProposalDomainEntity[]> {
    const entities = await this.repository.find({ where: { coopname } });
    return entities.map((e) => ExpenseProposalMapper.toDomain(e));
  }

  async findByUsername(coopname: string, username: string): Promise<ExpenseProposalDomainEntity[]> {
    const entities = await this.repository.find({ where: { coopname, username } });
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
    const sortBy = options?.sortBy ?? '_created_at';
    const sortOrder = options?.sortOrder ?? 'DESC';

    const [entities, totalCount] = await this.repository.findAndCount({
      where,
      order: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    });
    return {
      items: entities.map((e) => ExpenseProposalMapper.toDomain(e)),
      totalCount,
    };
  }
}
