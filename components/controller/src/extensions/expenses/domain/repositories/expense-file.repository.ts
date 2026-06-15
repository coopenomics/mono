import type { IExpenseFileDatabaseData } from '../interfaces/expense-file-database.interface';

/**
 * Реестр первичных файлов расхода. Файл — чистая БД-сущность (MinIO + метаданные);
 * блокчейна за ним нет, поэтому интерфейс не наследует `IBlockchainSyncRepository`.
 */
export interface ExpenseFileRepository {
  create(data: IExpenseFileDatabaseData): Promise<IExpenseFileDatabaseData>;
  findById(id: number): Promise<IExpenseFileDatabaseData | null>;
  findByChecksum(coopname: string, checksum: string): Promise<IExpenseFileDatabaseData | null>;
  findByProposal(coopname: string, proposalHash: string): Promise<IExpenseFileDatabaseData[]>;
  findByItem(coopname: string, proposalHash: string, itemHash: string): Promise<IExpenseFileDatabaseData[]>;
  delete(id: number): Promise<void>;
}

export const EXPENSE_FILE_REPOSITORY = Symbol('ExpenseFileRepository');
