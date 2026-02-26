import { ResultStatus } from '../enums/result-status.enum';
import type { IResultDatabaseData } from '../interfaces/result-database.interface';
import type { IResultBlockchainData } from '../interfaces/result-blockchain.interface';
import type { ISignedDocumentDomainInterface } from '~/domain/document/interfaces/signed-document-domain.interface';
import type { IBlockchainSynchronizable } from '~/shared/interfaces/blockchain-sync.interface';
import { BaseDomainEntity } from '~/shared/sync/entities/base-domain.entity';
/**
 * Доменная сущность результата
 *
 * Полностью агрегирует данные из двух источников:
 * - База данных: внутренний ID, ссылка на блокчейн
 * - Блокчейн: все данные результата из таблицы results
 */
export class ResultDomainEntity
  extends BaseDomainEntity<IResultDatabaseData>
  implements IBlockchainSynchronizable, Partial<IResultBlockchainData>
{
  // Статические поля ключей для поиска и синхронизации
  private static primary_key = 'id';
  private static sync_key = 'result_hash';

  // Специфичные поля для result
  public id?: number; // ID в блокчейне
  public status: ResultStatus;
  public data?: string; // Структурированные данные результата

  // Поля из блокчейна (results.hpp)
  public project_hash?: IResultBlockchainData['project_hash'];
  public result_hash: IResultBlockchainData['result_hash'];
  public coopname?: IResultBlockchainData['coopname'];
  public username?: IResultBlockchainData['username'];
  public blockchain_status?: IResultBlockchainData['status']; // Статус из блокчейна
  public created_at?: IResultBlockchainData['created_at'];
  public debt_amount?: IResultBlockchainData['debt_amount'];
  public total_amount?: IResultBlockchainData['total_amount'];
  public statement?: ISignedDocumentDomainInterface;
  public authorization?: ISignedDocumentDomainInterface;
  public act?: ISignedDocumentDomainInterface;

  /**
   * Конструктор для сборки композитной сущности
   *
   * @param databaseData - данные из базы данных
   * @param blockchainData - данные из блокчейна
   */
  constructor(databaseData: IResultDatabaseData, blockchainData?: IResultBlockchainData) {
    // Вызываем конструктор базового класса с данными
    super(databaseData, ResultStatus.UNDEFINED);

    // Специфичные поля для result
    this.status = this.mapStatusToDomain(databaseData.status);
    this.result_hash = databaseData.result_hash.toLowerCase();
    this.project_hash = databaseData.project_hash.toLowerCase();
    this.coopname = databaseData.coopname;
    this.username = databaseData.username;
    this.data = databaseData.data;


    // Данные из блокчейна
    if (blockchainData) {
      if (this.result_hash != blockchainData.result_hash.toLowerCase()) throw new Error('Result hash mismatch');

      this.id = Number(blockchainData.id);
      this.project_hash = blockchainData.project_hash.toLowerCase();
      this.result_hash = blockchainData.result_hash.toLowerCase();
      this.coopname = blockchainData.coopname;
      this.username = blockchainData.username;
      this.blockchain_status = blockchainData.status;
      this.created_at = blockchainData.created_at;
      this.debt_amount = blockchainData.debt_amount;
      this.total_amount = blockchainData.total_amount;
      this.statement = blockchainData.statement;
      this.authorization = blockchainData.authorization;
      this.act = blockchainData.act;

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
    return ResultDomainEntity.primary_key;
  }

  /**
   * Получение ключа для синхронизации сущности в блокчейне и базе данных (статический метод)
   */
  public static getSyncKey(): string {
    return ResultDomainEntity.sync_key;
  }

  /**
   * Получение ключа для поиска сущности в блокчейне
   */
  getPrimaryKey(): string {
    return ResultDomainEntity.primary_key;
  }

  /**
   * Получение ключа для синхронизации сущности в блокчейне и базе данных
   */
  getSyncKey(): string {
    return ResultDomainEntity.sync_key;
  }

  /**
   * Обновление данных из блокчейна
   * Обновляет текущий экземпляр
   */
  updateFromBlockchain(blockchainData: IResultBlockchainData, blockNum: number, present = true): void {
    // Обновляем базовые поля через метод базового класса
    this.block_num = blockNum;
    this.present = present;
    const data = this.data;
    // Обновляем специфичные поля из блокчейна
    Object.assign(this, blockchainData);
    this.blockchain_status = blockchainData.status;
    this.status = this.mapStatusToDomain(blockchainData.status);
    this.data = data;
    // Нормализация hash полей
    if (this.project_hash) this.project_hash = this.project_hash.toLowerCase();
    if (this.result_hash) this.result_hash = this.result_hash.toLowerCase();
  }

  /**
   * Маппинг статуса из блокчейна в доменный статус
   * Синхронизировано с константами из results.hpp
   */
  private mapStatusToDomain(blockchainStatus?: string): ResultStatus {
    switch (blockchainStatus) {
      case 'pending':
        return ResultStatus.PENDING;
      case 'created':
        return ResultStatus.CREATED;
      case 'approved':
        return ResultStatus.APPROVED;
      case 'authorized':
        return ResultStatus.AUTHORIZED;
      case 'act1':
        return ResultStatus.ACT1;
      case 'act2':
        return ResultStatus.ACT2;
      case 'declined':
        return ResultStatus.DECLINED;
      default:
        // По умолчанию считаем результат отклоненным для безопасности

        return ResultStatus.UNDEFINED;
    }
  }
}
