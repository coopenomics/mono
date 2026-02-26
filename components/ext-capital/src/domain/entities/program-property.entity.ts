import { ProgramPropertyStatus } from '../enums/program-property-status.enum';
import type { IProgramPropertyDatabaseData } from '../interfaces/program-property-database.interface';
import type { IProgramPropertyBlockchainData } from '../interfaces/program-property-blockchain.interface';
import type { ISignedDocumentDomainInterface } from '~/domain/document/interfaces/signed-document-domain.interface';
import type { IBlockchainSynchronizable } from '~/shared/interfaces/blockchain-sync.interface';
import { randomUUID } from 'crypto';
import { BaseDomainEntity } from '~/shared/sync/entities/base-domain.entity';

/**
 * Доменная сущность программного имущественного взноса
 *
 * Полностью агрегирует данные из двух источников:
 * - База данных: внутренний ID, ссылка на блокчейн
 * - Блокчейн: все данные программного имущественного взноса из таблицы pgproperties
 */
export class ProgramPropertyDomainEntity
  extends BaseDomainEntity<IProgramPropertyDatabaseData>
  implements IBlockchainSynchronizable, Partial<IProgramPropertyBlockchainData>
{
  // Статические поля ключей для поиска и синхронизации
  private static primary_key = 'id';
  private static sync_key = 'property_hash';

  // Специфичные поля для program-property
  public id?: number; // ID в блокчейне
  public status: ProgramPropertyStatus;

  // Поля из блокчейна (program_properties.hpp)
  public property_hash: IProgramPropertyBlockchainData['property_hash'];

  public coopname?: IProgramPropertyBlockchainData['coopname'];
  public username?: IProgramPropertyBlockchainData['username'];
  public blockchain_status?: IProgramPropertyBlockchainData['status']; // Статус из блокчейна
  public property_amount?: IProgramPropertyBlockchainData['property_amount'];
  public property_description?: IProgramPropertyBlockchainData['property_description'];
  public statement?: ISignedDocumentDomainInterface;
  public authorization?: ISignedDocumentDomainInterface;
  public act?: ISignedDocumentDomainInterface;
  public created_at?: IProgramPropertyBlockchainData['created_at'];

  /**
   * Конструктор для сборки композитной сущности
   *
   * @param databaseData - данные из базы данных
   * @param blockchainData - данные из блокчейна
   */
  constructor(databaseData: IProgramPropertyDatabaseData, blockchainData?: IProgramPropertyBlockchainData) {
    // Вызываем конструктор базового класса с данными
    super(databaseData, ProgramPropertyStatus.UNDEFINED);

    // Специфичные поля для program-property
    this.status = this.mapStatusToDomain(databaseData.status);
    this.property_hash = databaseData.property_hash.toLowerCase();

    // Данные из блокчейна
    if (blockchainData) {
      if (this.property_hash != blockchainData.property_hash.toLowerCase())
        throw new Error('Program property hash mismatch');

      this.id = Number(blockchainData.id);
      this.coopname = blockchainData.coopname;
      this.username = blockchainData.username;
      this.blockchain_status = blockchainData.status;
      this.property_hash = blockchainData.property_hash.toLowerCase();
      this.property_amount = blockchainData.property_amount;
      this.property_description = blockchainData.property_description;
      this.statement = blockchainData.statement;
      this.authorization = blockchainData.authorization;
      this.act = blockchainData.act;
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
    return ProgramPropertyDomainEntity.primary_key;
  }

  /**
   * Получение ключа для синхронизации сущности в блокчейне и базе данных (статический метод)
   */
  public static getSyncKey(): string {
    return ProgramPropertyDomainEntity.sync_key;
  }

  /**
   * Получение ключа для поиска сущности в блокчейне
   */
  getPrimaryKey(): string {
    return ProgramPropertyDomainEntity.primary_key;
  }

  /**
   * Получение ключа для синхронизации сущности в блокчейне и базе данных
   */
  getSyncKey(): string {
    return ProgramPropertyDomainEntity.sync_key;
  }

  /**
   * Обновление данных из блокчейна
   * Обновляет текущий экземпляр
   */
  updateFromBlockchain(blockchainData: IProgramPropertyBlockchainData, blockNum: number, present = true): void {
    // Обновляем базовые поля через метод базового класса
    this.block_num = blockNum;
    this.present = present;

    // Обновляем специфичные поля из блокчейна
    Object.assign(this, blockchainData);
    this.blockchain_status = blockchainData.status;
    this.status = this.mapStatusToDomain(blockchainData.status);

    // Нормализация hash полей
    if (this.property_hash) this.property_hash = this.property_hash.toLowerCase();
  }

  /**
   * Маппинг статуса из блокчейна в доменный статус
   * Синхронизировано с константами из program_properties.hpp
   */
  private mapStatusToDomain(blockchainStatus?: string): ProgramPropertyStatus {
    switch (blockchainStatus) {
      case 'created':
        return ProgramPropertyStatus.CREATED;
      case 'approved':
        return ProgramPropertyStatus.APPROVED;
      case 'authorized':
        return ProgramPropertyStatus.AUTHORIZED;
      case 'act1':
        return ProgramPropertyStatus.ACT1;
      case 'act2':
        return ProgramPropertyStatus.ACT2;
      default:
        return ProgramPropertyStatus.UNDEFINED;
    }
  }
}
