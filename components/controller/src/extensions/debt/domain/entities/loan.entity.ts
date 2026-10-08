import { BaseDomainEntity } from '@coopenomics/extension-kit/sync';
import type { IBlockchainSynchronizable } from '@coopenomics/extension-kit/sync';
import type { ISignedDocument } from '@coopenomics/innercoop';
import type { ILoanDatabaseData } from '../interfaces/loan-database.interface';
import type { ILoanBlockchainData } from '../interfaces/loan-blockchain.interface';
import { CHAIN_STATUS_TO_LOAN_STATUS, LoanStatus } from '../enums/loan-status.enum';

/**
 * Доменная сущность займа — зеркало строки `debts` контракта `debt`.
 *
 * Запись в цепи живёт, пока заём открыт; на закрытии контракт её удаляет.
 * Зеркало хранит последнее состояние и выводит итог по нему: заём, который
 * был выдан, закрыт; заём, который до выплаты не дошёл, отклонён или отменён.
 */
export class LoanDomainEntity extends BaseDomainEntity<ILoanDatabaseData> implements IBlockchainSynchronizable {
  private static primary_key = 'id';
  private static sync_key = 'debt_hash';

  public id?: number;
  public debt_hash: string;
  public coopname: string;
  public status: LoanStatus;

  public username?: string;
  public blockchain_status?: string;
  public collateral?: string;
  public source?: string;
  public source_ref?: string;
  public amount?: string;
  public remaining?: string;
  public pledged?: string;
  public created_at?: string;
  public issued_at?: string;
  public due_at?: string;
  public requested_due_at?: string;
  public overdue_at?: string;
  public statement?: ISignedDocument;
  public contract?: ISignedDocument;
  public signed_contract?: ISignedDocument;
  public decision?: ISignedDocument;
  public extension_statement?: ISignedDocument;
  public last_pay_error?: string;
  public memo?: string;

  constructor(databaseData: ILoanDatabaseData, blockchainData?: ILoanBlockchainData) {
    super(databaseData, LoanStatus.UNDEFINED);

    this.debt_hash = databaseData.debt_hash.toLowerCase();
    this.coopname = databaseData.coopname;
    this.status = databaseData.status ?? LoanStatus.UNDEFINED;

    if (blockchainData) {
      this.applyBlockchainData(blockchainData);
    }
  }

  private applyBlockchainData(blockchainData: ILoanBlockchainData): void {
    if (this.debt_hash !== blockchainData.debt_hash.toLowerCase()) {
      throw new Error(`Loan hash mismatch: db=${this.debt_hash}, bc=${blockchainData.debt_hash.toLowerCase()}`);
    }
    this.id = Number(blockchainData.id);
    this.coopname = blockchainData.coopname;
    this.username = blockchainData.username;
    this.blockchain_status = blockchainData.status;
    this.collateral = blockchainData.collateral;
    this.source = blockchainData.source;
    this.source_ref = blockchainData.source_ref;
    this.amount = blockchainData.amount;
    this.remaining = blockchainData.remaining;
    this.pledged = blockchainData.pledged;
    this.created_at = blockchainData.created_at;
    this.issued_at = blockchainData.issued_at;
    this.due_at = blockchainData.due_at;
    this.requested_due_at = blockchainData.requested_due_at;
    this.overdue_at = blockchainData.overdue_at;
    // Документы и причину отказа цепь к закрытию не стирает; пустое значение
    // прежнего не затирает — зеркало хранит историю закрытого займа.
    this.statement = blockchainData.statement ?? this.statement;
    this.contract = blockchainData.contract ?? this.contract;
    this.signed_contract = blockchainData.signed_contract ?? this.signed_contract;
    this.decision = blockchainData.decision ?? this.decision;
    this.extension_statement = blockchainData.extension_statement ?? this.extension_statement;
    this.last_pay_error = blockchainData.last_pay_error;
    this.memo = blockchainData.memo;
    this.status = LoanDomainEntity.resolveStatus(this.present, blockchainData.status, blockchainData.issued_at);
  }

  getBlockNum(): number | undefined {
    return this.block_num;
  }

  updateFromBlockchain(blockchainData: ILoanBlockchainData, blockNum: number, present = true): void {
    this.block_num = blockNum;
    this.present = present;
    this.applyBlockchainData(blockchainData);
  }

  /**
   * Состояние зеркала из состояния цепи и признака присутствия строки.
   * Пустая дата выдачи у цепи — «1970-01-01T00:00:00».
   */
  static resolveStatus(present: boolean | undefined, chainStatus: string, issuedAt: string): LoanStatus {
    if (present !== false) {
      return CHAIN_STATUS_TO_LOAN_STATUS[chainStatus] ?? LoanStatus.UNDEFINED;
    }
    const wasIssued = Boolean(issuedAt) && !issuedAt.startsWith('1970');
    return wasIssued ? LoanStatus.CLOSED : LoanStatus.DECLINED;
  }

  static getPrimaryKey(): string {
    return LoanDomainEntity.primary_key;
  }

  static getSyncKey(): string {
    return LoanDomainEntity.sync_key;
  }

  getPrimaryKey(): string {
    return LoanDomainEntity.primary_key;
  }

  getSyncKey(): string {
    return LoanDomainEntity.sync_key;
  }

  getSyncValue(): string {
    return this.debt_hash;
  }

  /** Заём выдан контрактом займов, а не зарегистрирован другим приложением. */
  get isOwn(): boolean {
    return this.source === 'debt';
  }
}
