import { BaseDomainEntity } from '~/shared/sync/entities/base-domain.entity';
import type { IBlockchainSynchronizable } from '~/shared/interfaces/blockchain-sync.interface';
import type { ISignedDocumentDomainInterface } from '~/domain/document/interfaces/signed-document-domain.interface';
import type { IExpenseProposalDatabaseData } from '../interfaces/expense-proposal-database.interface';
import type {
  IExpenseProposalBlockchainData,
  IExpenseProposalCallbackHandler,
  IExpenseItemBlockchainData,
} from '../interfaces/expense-proposal-blockchain.interface';
import { ExpenseProposalStatus } from '../enums/expense-proposal-status.enum';

/**
 * Доменная сущность СЗ-расхода.
 *
 * Зеркалит строку `proposals` контракта `expense` (scope = coopname).
 * Композиция БД + блокчейна: БД хранит идентификацию + нормализованный
 * статус; блокчейн — экономику items, ссылки на документы и колбэк
 * закрытия. Конструктор бросает при рассинхроне `proposal_hash`.
 */
export class ExpenseProposalDomainEntity
  extends BaseDomainEntity<IExpenseProposalDatabaseData>
  implements IBlockchainSynchronizable
{
  private static primary_key = 'id';
  private static sync_key = 'proposal_hash';

  public id?: number;
  public proposal_hash: string;
  public coopname: string;
  public status: ExpenseProposalStatus;

  public username?: string;
  public source_wallet?: string;
  public blockchain_status?: number;
  public items?: IExpenseItemBlockchainData[];
  public total_planned?: string;
  public total_actual?: string;
  public callback?: IExpenseProposalCallbackHandler;
  public statement_doc?: ISignedDocumentDomainInterface;
  public decision_doc?: ISignedDocumentDomainInterface;
  public created_at?: string;
  public updated_at?: string;

  constructor(databaseData: IExpenseProposalDatabaseData, blockchainData?: IExpenseProposalBlockchainData) {
    super(databaseData, ExpenseProposalStatus.UNDEFINED);

    this.proposal_hash = databaseData.proposal_hash.toLowerCase();
    this.coopname = databaseData.coopname;
    this.status = databaseData.status ?? ExpenseProposalStatus.UNDEFINED;

    if (blockchainData) {
      if (this.proposal_hash !== blockchainData.proposal_hash.toLowerCase()) {
        throw new Error(
          `Expense proposal hash mismatch: db=${this.proposal_hash}, bc=${blockchainData.proposal_hash.toLowerCase()}`
        );
      }

      this.id = Number(blockchainData.id);
      this.coopname = blockchainData.coopname;
      this.username = blockchainData.username;
      this.source_wallet = blockchainData.source_wallet;
      this.blockchain_status = blockchainData.status;
      this.items = blockchainData.items;
      this.total_planned = blockchainData.total_planned;
      this.total_actual = blockchainData.total_actual;
      this.callback = blockchainData.callback;
      this.statement_doc = blockchainData.statement_doc;
      this.decision_doc = blockchainData.decision_doc;
      this.created_at = blockchainData.created_at;
      this.updated_at = blockchainData.updated_at;

      this.status = ExpenseProposalDomainEntity.mapStatusToDomain(blockchainData.status);
    }
  }

  getBlockNum(): number | undefined {
    return this.block_num;
  }

  public static getPrimaryKey(): string {
    return ExpenseProposalDomainEntity.primary_key;
  }

  public static getSyncKey(): string {
    return ExpenseProposalDomainEntity.sync_key;
  }

  getPrimaryKey(): string {
    return ExpenseProposalDomainEntity.primary_key;
  }

  getSyncKey(): string {
    return ExpenseProposalDomainEntity.sync_key;
  }

  updateFromBlockchain(blockchainData: IExpenseProposalBlockchainData, blockNum: number, present = true): void {
    if (this.proposal_hash !== blockchainData.proposal_hash.toLowerCase()) {
      throw new Error('Expense proposal hash mismatch on updateFromBlockchain');
    }
    this.id = Number(blockchainData.id);
    this.username = blockchainData.username;
    this.source_wallet = blockchainData.source_wallet;
    this.blockchain_status = blockchainData.status;
    this.items = blockchainData.items;
    this.total_planned = blockchainData.total_planned;
    this.total_actual = blockchainData.total_actual;
    this.callback = blockchainData.callback;
    this.statement_doc = blockchainData.statement_doc;
    this.decision_doc = blockchainData.decision_doc;
    this.created_at = blockchainData.created_at;
    this.updated_at = blockchainData.updated_at;
    this.status = ExpenseProposalDomainEntity.mapStatusToDomain(blockchainData.status);
    this.block_num = blockNum;
    this.present = present;
  }

  /**
   * Маппит `uint8_t status` (`ExpenseDomain::ProposalStatus`) → enum.
   * Неизвестное значение → UNDEFINED (alert на schema drift по канону).
   */
  private static mapStatusToDomain(raw: number): ExpenseProposalStatus {
    switch (raw) {
      case 0:
        return ExpenseProposalStatus.CREATED;
      case 1:
        return ExpenseProposalStatus.AUTHORIZED;
      case 2:
        return ExpenseProposalStatus.PARTIALLY_PAID;
      case 3:
        return ExpenseProposalStatus.REPORT_SUBMITTED;
      case 4:
        return ExpenseProposalStatus.CLOSED;
      case 5:
        return ExpenseProposalStatus.DECLINED;
      default:
        return ExpenseProposalStatus.UNDEFINED;
    }
  }
}
