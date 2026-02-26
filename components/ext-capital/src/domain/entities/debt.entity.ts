import { DebtStatus } from '../enums/debt-status.enum';
import type { IDebtDatabaseData } from '../interfaces/debt-database.interface';
import type { IDebtBlockchainData } from '../interfaces/debt-blockchain.interface';
import type { ISignedDocumentDomainInterface } from '~/domain/document/interfaces/signed-document-domain.interface';
import type { IBlockchainSynchronizable } from '~/shared/interfaces/blockchain-sync.interface';
import { BaseDomainEntity } from '~/shared/sync/entities/base-domain.entity';

/**
 * Доменная сущность долга
 *
 * Полностью агрегирует данные из двух источников:
 * - База данных: внутренний ID, ссылка на блокчейн
 * - Блокчейн: все данные долга из таблицы debts
 */
export class DebtDomainEntity
  extends BaseDomainEntity<IDebtDatabaseData>
  implements IBlockchainSynchronizable, Partial<IDebtBlockchainData>
{
  // Статические поля ключей для поиска и синхронизации
  private static primary_key = 'id';
  private static sync_key = 'debt_hash';

  // Специфичные поля для debt
  public id?: number; // ID в блокчейне
  public status: DebtStatus;

  // Поля из блокчейна (debts.hpp)
  public debt_hash: IDebtBlockchainData['debt_hash'];

  public coopname?: IDebtBlockchainData['coopname'];
  public username?: IDebtBlockchainData['username'];
  public project_hash?: IDebtBlockchainData['project_hash'];
  public blockchain_status?: IDebtBlockchainData['status']; // Статус из блокчейна
  public repaid_at?: IDebtBlockchainData['repaid_at'];
  public amount?: IDebtBlockchainData['amount'];
  public statement?: ISignedDocumentDomainInterface;
  public approved_statement?: ISignedDocumentDomainInterface;
  public authorization?: ISignedDocumentDomainInterface;
  public memo?: IDebtBlockchainData['memo'];

  /**
   * Конструктор для сборки композитной сущности
   *
   * @param databaseData - данные из базы данных
   * @param blockchainData - данные из блокчейна
   */
  constructor(databaseData: IDebtDatabaseData, blockchainData?: IDebtBlockchainData) {
    // Вызываем конструктор базового класса с данными
    super(databaseData, DebtStatus.PENDING);

    // Специфичные поля для debt
    this.status = this.mapStatusToDomain(databaseData.status);
    this.debt_hash = databaseData.debt_hash.toLowerCase();

    // Данные из блокчейна
    if (blockchainData) {
      if (this.debt_hash != blockchainData.debt_hash.toLowerCase()) throw new Error('Debt hash mismatch');

      this.id = Number(blockchainData.id);
      this.coopname = blockchainData.coopname;
      this.username = blockchainData.username;
      this.debt_hash = blockchainData.debt_hash.toLowerCase();
      this.project_hash = blockchainData.project_hash.toLowerCase();
      this.blockchain_status = blockchainData.status;
      this.repaid_at = blockchainData.repaid_at;
      this.amount = blockchainData.amount;
      this.statement = blockchainData.statement;
      this.approved_statement = blockchainData.approved_statement;
      this.authorization = blockchainData.authorization;
      this.memo = blockchainData.memo;

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
    return DebtDomainEntity.primary_key;
  }

  /**
   * Получение ключа для синхронизации сущности в блокчейне и базе данных (статический метод)
   */
  public static getSyncKey(): string {
    return DebtDomainEntity.sync_key;
  }

  /**
   * Получение ключа для поиска сущности в блокчейне
   */
  getPrimaryKey(): string {
    return DebtDomainEntity.primary_key;
  }

  /**
   * Получение ключа для синхронизации сущности в блокчейне и базе данных
   */
  getSyncKey(): string {
    return DebtDomainEntity.sync_key;
  }

  /**
   * Обновление данных из блокчейна
   * Обновляет текущий экземпляр
   */
  updateFromBlockchain(blockchainData: IDebtBlockchainData, blockNum: number, present = true): void {
    // Обновляем базовые поля через метод базового класса
    this.block_num = blockNum;
    this.present = present;

    // Обновляем специфичные поля из блокчейна
    Object.assign(this, blockchainData);
    this.blockchain_status = blockchainData.status;
    this.status = this.mapStatusToDomain(blockchainData.status);

    // Нормализация hash полей
    if (this.debt_hash) this.debt_hash = this.debt_hash.toLowerCase();
    if (this.project_hash) this.project_hash = this.project_hash.toLowerCase();
  }

  /**
   * Маппинг статуса из блокчейна в доменный статус
   * Синхронизировано с константами из debts.hpp
   */
  private mapStatusToDomain(blockchainStatus?: string): DebtStatus {
    switch (blockchainStatus) {
      case 'pending':
        return DebtStatus.PENDING;
      case 'approved':
        return DebtStatus.APPROVED;
      case 'active':
        return DebtStatus.ACTIVE;
      case 'settled':
        return DebtStatus.SETTLED;
      case 'cancelled':
        return DebtStatus.CANCELLED;
      default:
        // По умолчанию считаем статус неопределенным

        return DebtStatus.UNDEFINED;
    }
  }
}
