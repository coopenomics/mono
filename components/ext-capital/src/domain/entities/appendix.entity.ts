import { AppendixStatus } from '../enums/appendix-status.enum';
import type { IAppendixDatabaseData } from '../interfaces/appendix-database.interface';
import type { IAppendixBlockchainData } from '../interfaces/appendix-blockchain.interface';
import type { ISignedDocumentDomainInterface } from '~/domain/document/interfaces/signed-document-domain.interface';
import type { IBlockchainSynchronizable } from '~/shared/interfaces/blockchain-sync.interface';
import { BaseDomainEntity } from '~/shared/sync/entities/base-domain.entity';

/**
 * Доменная сущность приложения
 *
 * Полностью агрегирует данные из двух источников:
 * - База данных: внутренний ID, ссылка на блокчейн
 * - Блокчейн: все данные приложения из таблицы appendixes
 */
export class AppendixDomainEntity
  extends BaseDomainEntity<IAppendixDatabaseData>
  implements IBlockchainSynchronizable, Partial<IAppendixBlockchainData>
{
  // Статические поля ключей для поиска и синхронизации
  private static primary_key = 'id';
  private static sync_key = 'appendix_hash';

  // Специфичные поля для appendix
  public id?: number; // ID в блокчейне
  public status: AppendixStatus;

  // Поля из блокчейна (appendix.hpp)
  public appendix_hash: IAppendixBlockchainData['appendix_hash'];

  public coopname?: IAppendixBlockchainData['coopname'];
  public username?: IAppendixBlockchainData['username'];
  public project_hash?: IAppendixBlockchainData['project_hash'];
  public blockchain_status?: IAppendixBlockchainData['status']; // Статус из блокчейна
  public created_at?: IAppendixBlockchainData['created_at'];
  public appendix?: ISignedDocumentDomainInterface;
  public contribution?: string;

  /**
   * Конструктор для сборки композитной сущности
   *
   * @param databaseData - данные из базы данных
   * @param blockchainData - данные из блокчейна
   */
  constructor(databaseData: IAppendixDatabaseData, blockchainData?: IAppendixBlockchainData) {
    // Вызываем конструктор базового класса с данными
    super(databaseData, AppendixStatus.UNDEFINED);

    // Специфичные поля для appendix
    this.status = this.mapStatusToDomain(databaseData.status);
    this.appendix_hash = databaseData.appendix_hash.toLowerCase();
    this.contribution = databaseData.contribution;

    // Данные из блокчейна
    if (blockchainData) {
      if (this.appendix_hash != blockchainData.appendix_hash.toLowerCase()) throw new Error('Appendix hash mismatch');

      this.id = Number(blockchainData.id);
      this.coopname = blockchainData.coopname;
      this.username = blockchainData.username;
      this.project_hash = blockchainData.project_hash.toLowerCase();
      this.appendix_hash = blockchainData.appendix_hash.toLowerCase();
      this.blockchain_status = blockchainData.status;
      this.created_at = blockchainData.created_at;
      this.appendix = blockchainData.appendix;

      // Статус управляется действиями, не синхронизируем с блокчейн данными
      // this.status = this.mapStatusToDomain(blockchainData.status);
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
    return AppendixDomainEntity.primary_key;
  }

  /**
   * Получение ключа для синхронизации сущности в блокчейне и базе данных
   */
  public static getSyncKey(): string {
    return AppendixDomainEntity.sync_key;
  }

  /**
   * Получение ключа для поиска сущности в блокчейне
   */
  getPrimaryKey(): string {
    return AppendixDomainEntity.primary_key;
  }

  /**
   * Получение ключа для синхронизации сущности в блокчейне и базе данных
   */
  getSyncKey(): string {
    return AppendixDomainEntity.sync_key;
  }

  /**
   * Обновление данных из блокчейна
   * Обновляет текущий экземпляр
   */
  updateFromBlockchain(blockchainData: IAppendixBlockchainData, blockNum: number, present = true): void {
    this.block_num = blockNum;
    this.present = present;

    // Обновляем специфичные поля из блокчейна, но НЕ статус (он управляется действиями)
    this.id = Number(blockchainData.id);
    this.coopname = blockchainData.coopname;
    this.username = blockchainData.username;
    this.project_hash = blockchainData.project_hash;
    this.appendix_hash = blockchainData.appendix_hash;
    this.created_at = blockchainData.created_at;
    this.appendix = blockchainData.appendix;
    // this.status = this.mapStatusToDomain(blockchainData.status); // НЕ ОБНОВЛЯЕМ - статус управляется действиями
    this.blockchain_status = blockchainData.status;

    // Нормализация hash полей
    if (this.appendix_hash) this.appendix_hash = this.appendix_hash.toLowerCase();
    if (this.project_hash) this.project_hash = this.project_hash.toLowerCase();
  }

  /**
   * Маппинг статуса из блокчейна в доменный статус
   * Синхронизировано с константами из appendix.hpp
   */
  private mapStatusToDomain(blockchainStatus?: string): AppendixStatus {
    switch (blockchainStatus) {
      case 'created':
        return AppendixStatus.CREATED;
      case 'confirmed':
        return AppendixStatus.CONFIRMED;
      case 'declined':
        return AppendixStatus.DECLINED;
      default:
        // По умолчанию считаем статус неопределенным
        return AppendixStatus.UNDEFINED;
    }
  }
}
