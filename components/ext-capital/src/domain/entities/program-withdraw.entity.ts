import { ProgramWithdrawStatus } from '../enums/program-withdraw-status.enum';
import type { IProgramWithdrawDatabaseData } from '../interfaces/program-withdraw-database.interface';
import type { IProgramWithdrawBlockchainData } from '../interfaces/program-withdraw-blockchain.interface';
import type { ISignedDocumentDomainInterface } from '~/domain/document/interfaces/signed-document-domain.interface';
import type { IBlockchainSynchronizable } from '~/shared/interfaces/blockchain-sync.interface';
import { BaseDomainEntity } from '~/shared/sync/entities/base-domain.entity';
/**
 * Доменная сущность возврата из программы
 *
 * Полностью агрегирует данные из двух источников:
 * - База данных: внутренний ID, ссылка на блокчейн
 * - Блокчейн: все данные возврата из программы из таблицы prgwithdraws
 */
export class ProgramWithdrawDomainEntity
  extends BaseDomainEntity<IProgramWithdrawDatabaseData>
  implements IBlockchainSynchronizable, Partial<IProgramWithdrawBlockchainData>
{
  // Статические поля ключей для поиска и синхронизации
  private static primary_key = 'id';
  private static sync_key = 'withdraw_hash';

  // Специфичные поля для program-withdraw
  public id?: number; // ID в блокчейне
  public status: ProgramWithdrawStatus;

  // Поля из блокчейна (program_withdraw.hpp)
  public withdraw_hash: IProgramWithdrawBlockchainData['withdraw_hash'];

  public coopname?: IProgramWithdrawBlockchainData['coopname'];
  public username?: IProgramWithdrawBlockchainData['username'];
  public blockchain_status?: IProgramWithdrawBlockchainData['status']; // Статус из блокчейна
  public amount?: IProgramWithdrawBlockchainData['amount'];
  public statement?: ISignedDocumentDomainInterface;
  public created_at?: IProgramWithdrawBlockchainData['created_at'];

  /**
   * Конструктор для сборки композитной сущности
   *
   * @param databaseData - данные из базы данных
   * @param blockchainData - данные из блокчейна
   */
  constructor(databaseData: IProgramWithdrawDatabaseData, blockchainData?: IProgramWithdrawBlockchainData) {
    // Вызываем конструктор базового класса с данными
    super(databaseData, ProgramWithdrawStatus.UNDEFINED);

    // Специфичные поля для program-withdraw
    this.status = this.mapStatusToDomain(databaseData.status);
    this.withdraw_hash = databaseData.withdraw_hash.toLowerCase();

    // Данные из блокчейна
    if (blockchainData) {
      if (this.withdraw_hash != blockchainData.withdraw_hash.toLowerCase())
        throw new Error('Program withdraw hash mismatch');

      this.id = Number(blockchainData.id);
      this.coopname = blockchainData.coopname;
      this.withdraw_hash = blockchainData.withdraw_hash.toLowerCase();
      this.username = blockchainData.username;
      this.blockchain_status = blockchainData.status;
      this.amount = blockchainData.amount;
      this.statement = blockchainData.statement;
      this.created_at = blockchainData.created_at;

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
    return ProgramWithdrawDomainEntity.primary_key;
  }

  /**
   * Получение ключа для синхронизации сущности в блокчейне и базе данных (статический метод)
   */
  public static getSyncKey(): string {
    return ProgramWithdrawDomainEntity.sync_key;
  }

  /**
   * Получение ключа для поиска сущности в блокчейне
   */
  getPrimaryKey(): string {
    return ProgramWithdrawDomainEntity.primary_key;
  }

  /**
   * Получение ключа для синхронизации сущности в блокчейне и базе данных
   */
  getSyncKey(): string {
    return ProgramWithdrawDomainEntity.sync_key;
  }

  /**
   * Обновление данных из блокчейна
   * Обновляет текущий экземпляр
   */
  updateFromBlockchain(blockchainData: IProgramWithdrawBlockchainData, blockNum: number, present = true): void {
    // Обновляем базовые поля через метод базового класса
    this.block_num = blockNum;
    this.present = present;

    // Обновляем специфичные поля из блокчейна
    Object.assign(this, blockchainData);
    this.blockchain_status = blockchainData.status;
    this.status = this.mapStatusToDomain(blockchainData.status);

    // Нормализация hash полей
    if (this.withdraw_hash) this.withdraw_hash = this.withdraw_hash.toLowerCase();
  }

  /**
   * Маппинг статуса из блокчейна в доменный статус
   * Синхронизировано с константами из program_withdraw.hpp
   */
  private mapStatusToDomain(blockchainStatus?: string): ProgramWithdrawStatus {
    switch (blockchainStatus) {
      case 'created':
        return ProgramWithdrawStatus.CREATED;
      case 'approved':
        return ProgramWithdrawStatus.APPROVED;
      default:
        return ProgramWithdrawStatus.UNDEFINED;
    }
  }
}
