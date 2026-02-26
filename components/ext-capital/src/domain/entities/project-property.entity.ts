import { ProjectPropertyStatus } from '../enums/project-property-status.enum';
import type { IProjectPropertyDatabaseData } from '../interfaces/project-property-database.interface';
import type { IProjectPropertyBlockchainData } from '../interfaces/project-property-blockchain.interface';
import type { IBlockchainSynchronizable } from '~/shared/interfaces/blockchain-sync.interface';
import { BaseDomainEntity } from '~/shared/sync/entities/base-domain.entity';
/**
 * Доменная сущность проектного имущественного взноса
 *
 * Полностью агрегирует данные из двух источников:
 * - База данных: внутренний ID, ссылка на блокчейн
 * - Блокчейн: все данные проектного имущественного взноса из таблицы pjproperties
 */
export class ProjectPropertyDomainEntity
  extends BaseDomainEntity<IProjectPropertyDatabaseData>
  implements IBlockchainSynchronizable, Partial<IProjectPropertyBlockchainData>
{
  // Статические поля ключей для поиска и синхронизации
  private static primary_key = 'id';
  private static sync_key = 'property_hash';
  // Поля из базы данных
  public id?: number; // ID в блокчейне

  // Доменные поля (расширения)
  public status: ProjectPropertyStatus;

  // Поля из блокчейна (project_properties.hpp)
  public property_hash: IProjectPropertyBlockchainData['property_hash'];

  public coopname?: IProjectPropertyBlockchainData['coopname'];
  public username?: IProjectPropertyBlockchainData['username'];
  public blockchain_status?: IProjectPropertyBlockchainData['status']; // Статус из блокчейна
  public project_hash?: IProjectPropertyBlockchainData['project_hash'];
  public property_amount?: IProjectPropertyBlockchainData['property_amount'];
  public property_description?: IProjectPropertyBlockchainData['property_description'];
  public created_at?: IProjectPropertyBlockchainData['created_at'];

  /**
   * Конструктор для сборки композитной сущности
   *
   * @param databaseData - данные из базы данных
   * @param blockchainData - данные из блокчейна
   */
  constructor(databaseData: IProjectPropertyDatabaseData, blockchainData?: IProjectPropertyBlockchainData) {
    // Вызываем конструктор базового класса без данных (инициализируем поля вручную)
    super(databaseData, ProjectPropertyStatus.UNDEFINED);

    // Переопределяем базовые поля из databaseData
    this.status = this.mapStatusToDomain(databaseData.status);

    // Специфичные поля для project-property
    this.property_hash = databaseData.property_hash.toLowerCase();

    // Данные из блокчейна
    if (blockchainData) {
      if (this.property_hash != blockchainData.property_hash.toLowerCase())
        throw new Error('Project property hash mismatch');

      this.id = Number(blockchainData.id);
      this.coopname = blockchainData.coopname;
      this.username = blockchainData.username;
      this.blockchain_status = blockchainData.status;
      this.project_hash = blockchainData.project_hash.toLowerCase();
      this.property_hash = blockchainData.property_hash.toLowerCase();
      this.property_amount = blockchainData.property_amount;
      this.property_description = blockchainData.property_description;
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
    return ProjectPropertyDomainEntity.primary_key;
  }

  /**
   * Получение ключа для синхронизации сущности в блокчейне и базе данных (статический метод)
   */
  public static getSyncKey(): string {
    return ProjectPropertyDomainEntity.sync_key;
  }

  /**
   * Получение ключа для поиска сущности в блокчейне
   */
  getPrimaryKey(): string {
    return ProjectPropertyDomainEntity.primary_key;
  }

  /**
   * Получение ключа для синхронизации сущности в блокчейне и базе данных
   */
  getSyncKey(): string {
    return ProjectPropertyDomainEntity.sync_key;
  }

  /**
   * Обновление данных из блокчейна
   * Обновляет текущий экземпляр
   */
  updateFromBlockchain(blockchainData: IProjectPropertyBlockchainData, blockNum: number, present = true): void {
    // Обновляем базовые поля через метод базового класса
    this.block_num = blockNum;
    this.present = present;

    // Обновляем специфичные поля из блокчейна
    Object.assign(this, blockchainData);
    this.blockchain_status = blockchainData.status;
    this.status = this.mapStatusToDomain(blockchainData.status);

    // Нормализация hash полей
    if (this.project_hash) this.project_hash = this.project_hash.toLowerCase();
    if (this.property_hash) this.property_hash = this.property_hash.toLowerCase();
  }

  /**
   * Маппинг статуса из блокчейна в доменный статус
   * Синхронизировано с константами из project_properties.hpp
   */
  private mapStatusToDomain(blockchainStatus?: string): ProjectPropertyStatus {
    switch (blockchainStatus) {
      case 'created':
        return ProjectPropertyStatus.CREATED;
      default:
        return ProjectPropertyStatus.UNDEFINED;
    }
  }
}
