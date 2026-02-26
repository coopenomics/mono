import { ExpenseStatus } from '../enums/expense-status.enum';
import type { IExpenseDatabaseData } from '../interfaces/expense-database.interface';
import type { IExpenseBlockchainData } from '../interfaces/expense-blockchain.interface';
import type { ISignedDocumentDomainInterface } from '~/domain/document/interfaces/signed-document-domain.interface';
import type { IBlockchainSynchronizable } from '~/shared/interfaces/blockchain-sync.interface';
import { BaseDomainEntity } from '~/shared/sync/entities/base-domain.entity';

/**
 * Доменная сущность расхода
 *
 * Полностью агрегирует данные из двух источников:
 * - База данных: внутренний ID, ссылка на блокчейн
 * - Блокчейн: все данные расхода из таблицы expenses
 */
export class ExpenseDomainEntity
  extends BaseDomainEntity<IExpenseDatabaseData>
  implements IBlockchainSynchronizable, Partial<IExpenseBlockchainData>
{
  // Статические поля ключей для поиска и синхронизации
  private static primary_key = 'id';
  private static sync_key = 'expense_hash';

  // Специфичные поля для expense
  public id?: number; // ID в блокчейне
  public status: ExpenseStatus;

  // Поля из блокчейна (expenses.hpp)
  public expense_hash: IExpenseBlockchainData['expense_hash'];

  public coopname?: IExpenseBlockchainData['coopname'];
  public username?: IExpenseBlockchainData['username'];
  public project_hash?: IExpenseBlockchainData['project_hash'];
  public fund_id?: IExpenseBlockchainData['fund_id'];
  public blockchain_status?: IExpenseBlockchainData['status']; // Статус из блокчейна
  public amount?: IExpenseBlockchainData['amount'];
  public description?: IExpenseBlockchainData['description'];
  public expense_statement?: ISignedDocumentDomainInterface;
  public approved_statement?: ISignedDocumentDomainInterface;
  public authorization?: ISignedDocumentDomainInterface;
  public spended_at?: IExpenseBlockchainData['spended_at'];

  /**
   * Конструктор для сборки композитной сущности
   *
   * @param databaseData - данные из базы данных
   * @param blockchainData - данные из блокчейна
   */
  constructor(databaseData: IExpenseDatabaseData, blockchainData?: IExpenseBlockchainData) {
    // Вызываем конструктор базового класса с данными
    super(databaseData, ExpenseStatus.PENDING);

    // Специфичные поля для expense
    this.status = this.mapStatusToDomain(databaseData.status);
    this.expense_hash = databaseData.expense_hash.toLowerCase();

    // Данные из блокчейна
    if (blockchainData) {
      if (this.expense_hash != blockchainData.expense_hash.toLowerCase()) throw new Error('Expense hash mismatch');

      this.id = Number(blockchainData.id);
      this.coopname = blockchainData.coopname;
      this.username = blockchainData.username;
      this.project_hash = blockchainData.project_hash.toLowerCase();
      this.expense_hash = blockchainData.expense_hash.toLowerCase();
      this.fund_id = blockchainData.fund_id;
      this.blockchain_status = blockchainData.status;
      this.amount = blockchainData.amount;
      this.description = blockchainData.description;
      this.expense_statement = blockchainData.expense_statement;
      this.approved_statement = blockchainData.approved_statement;
      this.authorization = blockchainData.authorization;
      this.spended_at = blockchainData.spended_at;

      // Синхронизация статуса с блокчейн данными
      this.status = this.mapStatusToDomain(blockchainData.status);
    }
  }

  /**
   * Получение номера блока последнего обновления
   */
  getBlockNum(): number | undefined {
    return this.block_num;
  }

  /**
   * Получение ключа для поиска сущности в блокчейне (статический метод)
   */
  public static getPrimaryKey(): string {
    return ExpenseDomainEntity.primary_key;
  }

  /**
   * Получение ключа для синхронизации сущности в блокчейне и базе данных (статический метод)
   */
  public static getSyncKey(): string {
    return ExpenseDomainEntity.sync_key;
  }

  /**
   * Получение ключа для поиска сущности в блокчейне
   */
  getPrimaryKey(): string {
    return ExpenseDomainEntity.primary_key;
  }

  /**
   * Получение ключа для синхронизации сущности в блокчейне и базе данных
   */
  getSyncKey(): string {
    return ExpenseDomainEntity.sync_key;
  }

  /**
   * Обновление данных из блокчейна
   * Обновляет текущий экземпляр
   */
  updateFromBlockchain(blockchainData: IExpenseBlockchainData, blockNum: number, present = true): void {
    this.block_num = blockNum;
    this.present = present;

    // Обновляем специфичные поля из блокчейна
    Object.assign(this, blockchainData);
    this.blockchain_status = blockchainData.status;
    this.status = this.mapStatusToDomain(blockchainData.status);

    // Нормализация hash полей
    if (this.expense_hash) this.expense_hash = this.expense_hash.toLowerCase();
    if (this.project_hash) this.project_hash = this.project_hash.toLowerCase();
  }

  /**
   * Маппинг статуса из блокчейна в доменный статус
   * Синхронизировано с константами из expenses.hpp
   */
  private mapStatusToDomain(blockchainStatus?: string): ExpenseStatus {
    switch (blockchainStatus) {
      case 'pending':
        return ExpenseStatus.PENDING;
      case 'approved':
        return ExpenseStatus.APPROVED;
      case 'paid':
        return ExpenseStatus.PAID;
      case 'declined':
        return ExpenseStatus.DECLINED;
      case 'cancelled':
        return ExpenseStatus.CANCELLED;
      default:
        // По умолчанию считаем статус неопределенным

        return ExpenseStatus.UNDEFINED;
    }
  }
}
