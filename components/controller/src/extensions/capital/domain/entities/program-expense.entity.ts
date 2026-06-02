import { ProgramExpenseStatus } from '../enums/program-expense-status.enum';
import type { IProgramExpenseDatabaseData } from '../interfaces/program-expense-database.interface';
import type { IProgramExpenseBlockchainData } from '../interfaces/program-expense-blockchain.interface';
import type { ISignedDocumentDomainInterface } from '~/domain/document/interfaces/signed-document-domain.interface';
import type { IBlockchainSynchronizable } from '~/shared/interfaces/blockchain-sync.interface';
import { BaseDomainEntity } from '~/shared/sync/entities/base-domain.entity';

/**
 * Доменная сущность программного расхода (таблица capital::progexpenses).
 *
 * Соответствует расходам программы «Благорост» — целевым списаниям из пула
 * `program_expense_pool`, не привязанным к проекту.
 */
export class ProgramExpenseDomainEntity
  extends BaseDomainEntity<IProgramExpenseDatabaseData>
  implements IBlockchainSynchronizable, Partial<IProgramExpenseBlockchainData>
{
  private static primary_key = 'id';
  private static sync_key = 'expense_hash';

  public id?: number;
  public status: ProgramExpenseStatus;

  public expense_hash: IProgramExpenseBlockchainData['expense_hash'];

  public coopname?: IProgramExpenseBlockchainData['coopname'];
  public username?: IProgramExpenseBlockchainData['username'];
  public fund_id?: IProgramExpenseBlockchainData['fund_id'];
  public blockchain_status?: IProgramExpenseBlockchainData['status'];
  public amount?: IProgramExpenseBlockchainData['amount'];
  public description?: IProgramExpenseBlockchainData['description'];
  public expense_statement?: ISignedDocumentDomainInterface;
  public approved_statement?: ISignedDocumentDomainInterface;
  public authorization?: ISignedDocumentDomainInterface;
  public spended_at?: IProgramExpenseBlockchainData['spended_at'];

  constructor(databaseData: IProgramExpenseDatabaseData, blockchainData?: IProgramExpenseBlockchainData) {
    super(databaseData, ProgramExpenseStatus.CREATED);

    this.status = this.mapStatusToDomain(databaseData.status);
    this.expense_hash = databaseData.expense_hash.toLowerCase();

    if (blockchainData) {
      if (this.expense_hash != blockchainData.expense_hash.toLowerCase())
        throw new Error('ProgramExpense hash mismatch');

      this.id = Number(blockchainData.id);
      this.coopname = blockchainData.coopname;
      this.username = blockchainData.username;
      this.expense_hash = blockchainData.expense_hash.toLowerCase();
      this.fund_id = blockchainData.fund_id;
      this.blockchain_status = blockchainData.status;
      this.amount = blockchainData.amount;
      this.description = blockchainData.description;
      this.expense_statement = blockchainData.expense_statement;
      this.approved_statement = blockchainData.approved_statement;
      this.authorization = blockchainData.authorization;
      this.spended_at = blockchainData.spended_at;

      this.status = this.mapStatusToDomain(blockchainData.status);
    }
  }

  getBlockNum(): number | undefined {
    return this.block_num;
  }

  public static getPrimaryKey(): string {
    return ProgramExpenseDomainEntity.primary_key;
  }

  public static getSyncKey(): string {
    return ProgramExpenseDomainEntity.sync_key;
  }

  getPrimaryKey(): string {
    return ProgramExpenseDomainEntity.primary_key;
  }

  getSyncKey(): string {
    return ProgramExpenseDomainEntity.sync_key;
  }

  updateFromBlockchain(blockchainData: IProgramExpenseBlockchainData, blockNum: number, present = true): void {
    this.block_num = blockNum;
    this.present = present;

    Object.assign(this, blockchainData);
    this.blockchain_status = blockchainData.status;
    this.status = this.mapStatusToDomain(blockchainData.status);

    if (this.expense_hash) this.expense_hash = this.expense_hash.toLowerCase();
  }

  private mapStatusToDomain(blockchainStatus?: string): ProgramExpenseStatus {
    switch (blockchainStatus) {
      case 'created':
        return ProgramExpenseStatus.CREATED;
      case 'approved':
        return ProgramExpenseStatus.APPROVED;
      case 'authorized':
        return ProgramExpenseStatus.AUTHORIZED;
      case 'paid':
        return ProgramExpenseStatus.PAID;
      case 'declined':
        return ProgramExpenseStatus.DECLINED;
      default:
        return ProgramExpenseStatus.UNDEFINED;
    }
  }
}
