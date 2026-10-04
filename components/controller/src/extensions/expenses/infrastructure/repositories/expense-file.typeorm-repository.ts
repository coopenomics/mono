import { TableStore } from '@coopenomics/extension-kit';
import { EXPENSES_FILE_STORE } from '../../infrastructure/database/expenses-stores';
import { Inject, Injectable } from '@nestjs/common';
import { ExpenseFileTypeormEntity } from '../entities/expense-file.typeorm-entity';
import { ExpenseFileMapper } from '../mappers/expense-file.mapper';
import type { ExpenseFileRepository } from '../../domain/repositories/expense-file.repository';
import type { IExpenseFileDatabaseData } from '../../domain/interfaces/expense-file-database.interface';

@Injectable()
export class ExpenseFileTypeormRepository implements ExpenseFileRepository {
  constructor(
    @Inject(EXPENSES_FILE_STORE)
    private readonly repository: TableStore<ExpenseFileTypeormEntity>
  ) {}

  async create(data: IExpenseFileDatabaseData): Promise<IExpenseFileDatabaseData> {
    const entity = this.repository.create(ExpenseFileMapper.toEntity(data));
    const saved = await this.repository.save(entity);
    return ExpenseFileMapper.toDomain(saved);
  }

  async findById(id: number): Promise<IExpenseFileDatabaseData | null> {
    const entity = await this.repository.findOne({ id });
    return entity ? ExpenseFileMapper.toDomain(entity) : null;
  }

  async findByChecksum(coopname: string, checksum: string): Promise<IExpenseFileDatabaseData | null> {
    const entity = await this.repository.findOne({ coopname, checksum_sha256: checksum });
    return entity ? ExpenseFileMapper.toDomain(entity) : null;
  }

  async findByProposal(coopname: string, proposalHash: string): Promise<IExpenseFileDatabaseData[]> {
    const entities = await this.repository.find({ coopname, proposal_hash: proposalHash.toLowerCase() }, { order: { uploaded_at: 'DESC' } });
    return entities.map((e) => ExpenseFileMapper.toDomain(e));
  }

  async findByItem(coopname: string, proposalHash: string, itemHash: string): Promise<IExpenseFileDatabaseData[]> {
    const entities = await this.repository.find({
        coopname,
        proposal_hash: proposalHash.toLowerCase(),
        item_hash: itemHash.toLowerCase(),
      }, { order: { uploaded_at: 'DESC' } });
    return entities.map((e) => ExpenseFileMapper.toDomain(e));
  }

  async delete(id: number): Promise<void> {
    await this.repository.delete({ id });
  }
}
