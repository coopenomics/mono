import { InvestStatus } from '../enums/invest-status.enum';
import type { IInvestDatabaseData } from '../interfaces/invest-database.interface';
import type { IInvestBlockchainData } from '../interfaces/invest-blockchain.interface';
import type { IBlockchainSynchronizable } from '~/shared/interfaces/blockchain-sync.interface';
import { BaseDomainEntity } from '~/shared/sync/entities/base-domain.entity';

/**
 * Доменная сущность инвестиции
 *
 * Полностью агрегирует данные из двух источников:
 * - База данных: внутренний ID, ссылка на блокчейн
 * - Блокчейн: все данные инвестиции из таблицы invests
 */
export class InvestDomainEntity
  extends BaseDomainEntity<IInvestDatabaseData>
  implements IBlockchainSynchronizable, Partial<IInvestBlockchainData>
{
  // Статические поля ключей для поиска и синхронизации
  private static primary_key = 'id';
  private static sync_key = 'invest_hash';

  // Специфичные поля для invest
  public id?: number; // ID в блокчейне
  public status: InvestStatus;

  // Поля из блокчейна (invests.hpp)
  public invest_hash: IInvestBlockchainData['invest_hash'];

  public coopname?: IInvestBlockchainData['coopname'];
  public username?: IInvestBlockchainData['username'];
  public project_hash?: IInvestBlockchainData['project_hash'];
  public blockchain_status?: IInvestBlockchainData['status']; // Статус из блокчейна
  public amount?: IInvestBlockchainData['amount'];
  public invested_at?: IInvestBlockchainData['invested_at'];
  public statement?: IInvestBlockchainData['statement'];
  public coordinator?: IInvestBlockchainData['coordinator'];
  public coordinator_amount?: IInvestBlockchainData['coordinator_amount'];

  /**
   * Конструктор для сборки композитной сущности
   *
   * @param databaseData - данные из базы данных
   * @param blockchainData - данные из блокчейна
   */
  constructor(databaseData: IInvestDatabaseData, blockchainData?: IInvestBlockchainData) {
    // Вызываем конструктор базового класса с данными
    super(databaseData, InvestStatus.PENDING);

    // Специфичные поля для invest
    this.status = this.mapStatusToDomain(databaseData.status);
    this.invest_hash = databaseData.invest_hash.toLowerCase();

    // Данные из блокчейна
    if (blockchainData) {
      if (this.invest_hash != blockchainData.invest_hash.toLowerCase()) throw new Error('Invest hash mismatch');

      this.id = Number(blockchainData.id);
      this.coopname = blockchainData.coopname;
      this.username = blockchainData.username;
      this.invest_hash = blockchainData.invest_hash.toLowerCase();
      this.project_hash = blockchainData.project_hash.toLowerCase();
      this.blockchain_status = blockchainData.status;
      this.amount = blockchainData.amount;
      this.invested_at = blockchainData.invested_at;
      this.statement = blockchainData.statement;
      this.coordinator = blockchainData.coordinator;
      this.coordinator_amount = blockchainData.coordinator_amount;

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
    return InvestDomainEntity.primary_key;
  }

  /**
   * Получение ключа для синхронизации сущности в блокчейне и базе данных (статический метод)
   */
  public static getSyncKey(): string {
    return InvestDomainEntity.sync_key;
  }

  /**
   * Получение ключа для поиска сущности в блокчейне
   */
  getPrimaryKey(): string {
    return InvestDomainEntity.primary_key;
  }

  /**
   * Получение ключа для синхронизации сущности в блокчейне и базе данных
   */
  getSyncKey(): string {
    return InvestDomainEntity.sync_key;
  }

  /**
   * Обновление данных из блокчейна
   * Обновляет текущий экземпляр
   */
  updateFromBlockchain(blockchainData: IInvestBlockchainData, blockNum: number, present = true): void {
    // Обновляем базовые поля через метод базового класса
    this.block_num = blockNum;
    this.present = present;

    // Обновляем специфичные поля из блокчейна
    Object.assign(this, blockchainData);
    this.blockchain_status = blockchainData.status;
    this.status = this.mapStatusToDomain(blockchainData.status);

    // Нормализация hash полей
    if (this.invest_hash) this.invest_hash = this.invest_hash.toLowerCase();
    if (this.project_hash) this.project_hash = this.project_hash.toLowerCase();
  }

  /**
   * Маппинг статуса из блокчейна в доменный статус
   * Синхронизировано с константами из invests.hpp
   */
  private mapStatusToDomain(blockchainStatus?: string): InvestStatus {
    switch (blockchainStatus) {
      case 'pending':
        return InvestStatus.PENDING;
      case 'approved':
        return InvestStatus.APPROVED;
      case 'active':
        return InvestStatus.ACTIVE;
      case 'returned':
        return InvestStatus.RETURNED;
      case 'cancelled':
        return InvestStatus.CANCELLED;
      default:
        // По умолчанию считаем статус неопределенным

        return InvestStatus.UNDEFINED;
    }
  }
}
