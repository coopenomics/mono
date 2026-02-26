import { ProgramInvestStatus } from '../enums/program-invest-status.enum';
import type { IProgramInvestDatabaseData } from '../interfaces/program-invest-database.interface';
import type { IProgramInvestBlockchainData } from '../interfaces/program-invest-blockchain.interface';
import type { ISignedDocumentDomainInterface } from '~/domain/document/interfaces/signed-document-domain.interface';
import type { IBlockchainSynchronizable } from '~/shared/interfaces/blockchain-sync.interface';
import { BaseDomainEntity } from '~/shared/sync/entities/base-domain.entity';

/**
 * Доменная сущность программной инвестиции
 *
 * Полностью агрегирует данные из двух источников:
 * - База данных: внутренний ID, ссылка на блокчейн
 * - Блокчейн: все данные программной инвестиции из таблицы progrinvests
 */
export class ProgramInvestDomainEntity
  extends BaseDomainEntity<IProgramInvestDatabaseData>
  implements IBlockchainSynchronizable, Partial<IProgramInvestBlockchainData>
{
  // Статические поля ключей для поиска и синхронизации
  private static primary_key = 'id';
  private static sync_key = 'invest_hash';

  // Поля из базы данных
  public id?: number; // ID в блокчейне

  // Доменные поля (расширения)
  public status: ProgramInvestStatus;

  // Поля из блокчейна (program_invests.hpp)
  public invest_hash: IProgramInvestBlockchainData['invest_hash'];

  public coopname?: IProgramInvestBlockchainData['coopname'];
  public username?: IProgramInvestBlockchainData['username'];
  public blockchain_status?: IProgramInvestBlockchainData['status']; // Статус из блокчейна
  public invested_at?: IProgramInvestBlockchainData['invested_at'];
  public statement?: ISignedDocumentDomainInterface;
  public amount?: IProgramInvestBlockchainData['amount'];

  /**
   * Конструктор для сборки композитной сущности
   *
   * @param databaseData - данные из базы данных
   * @param blockchainData - данные из блокчейна
   */
  constructor(databaseData: IProgramInvestDatabaseData, blockchainData?: IProgramInvestBlockchainData) {
    // Вызываем конструктор базового класса с данными
    super(databaseData, ProgramInvestStatus.UNDEFINED);

    // Специфичные поля для program-invest
    this.status = this.mapStatusToDomain(databaseData.status);
    this.invest_hash = databaseData.invest_hash.toLowerCase();

    // Данные из блокчейна
    if (blockchainData) {
      if (this.invest_hash != blockchainData.invest_hash.toLowerCase()) throw new Error('Program invest hash mismatch');

      this.id = Number(blockchainData.id);
      this.coopname = blockchainData.coopname;
      this.username = blockchainData.username;
      this.invest_hash = blockchainData.invest_hash.toLowerCase();
      this.blockchain_status = blockchainData.status;
      this.invested_at = blockchainData.invested_at;
      this.statement = blockchainData.statement;
      this.amount = blockchainData.amount;

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
    return ProgramInvestDomainEntity.primary_key;
  }

  /**
   * Получение ключа для синхронизации сущности в блокчейне и базе данных (статический метод)
   */
  public static getSyncKey(): string {
    return ProgramInvestDomainEntity.sync_key;
  }

  /**
   * Получение ключа для поиска сущности в блокчейне
   */
  getPrimaryKey(): string {
    return ProgramInvestDomainEntity.primary_key;
  }

  /**
   * Получение ключа для синхронизации сущности в блокчейне и базе данных
   */
  getSyncKey(): string {
    return ProgramInvestDomainEntity.sync_key;
  }

  /**
   * Обновление данных из блокчейна
   * Обновляет текущий экземпляр
   */
  updateFromBlockchain(blockchainData: IProgramInvestBlockchainData, blockNum: number, present = true): void {
    // Обновляем базовые поля через метод базового класса
    this.block_num = blockNum;
    this.present = present;

    // Обновляем специфичные поля из блокчейна
    Object.assign(this, blockchainData);
    this.blockchain_status = blockchainData.status;
    this.status = this.mapStatusToDomain(blockchainData.status);

    // Нормализация hash полей
    if (this.invest_hash) this.invest_hash = this.invest_hash.toLowerCase();
  }

  /**
   * Маппинг статуса из блокчейна в доменный статус
   * Синхронизировано с константами из program_invests.hpp
   */
  private mapStatusToDomain(blockchainStatus?: string): ProgramInvestStatus {
    switch (blockchainStatus) {
      case 'created':
        return ProgramInvestStatus.CREATED;
      default:
        return ProgramInvestStatus.UNDEFINED;
    }
  }
}
