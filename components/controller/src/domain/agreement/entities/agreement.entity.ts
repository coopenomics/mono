import { AgreementStatus } from '../enums/agreement-status.enum';
import type { IAgreementDatabaseData } from '../interfaces/agreement-database.interface';
import type { IAgreementBlockchainData } from '../interfaces/agreement-blockchain.interface';
import type { ISignedDocument } from '@coopenomics/innercoop';
import type { IBlockchainSynchronizable } from '@coopenomics/extension-kit/sync';
import { BaseDomainEntity } from '@coopenomics/extension-kit/sync';

/**
 * Доменная сущность соглашения
 *
 * Полностью агрегирует данные из двух источников:
 * - База данных: внутренний ID, ссылка на блокчейн
 * - Блокчейн: все данные соглашения из таблицы agreements3
 */
export class AgreementDomainEntity
  extends BaseDomainEntity<IAgreementDatabaseData>
  implements IBlockchainSynchronizable, Partial<IAgreementBlockchainData>
{
  // Статические ключи для синхронизации
  private static primary_key = 'id'; // Ключ для поиска в блокчейне
  private static sync_key = 'id'; // Ключ для синхронизации с БД (используем id соглашения)

  // Специфичные поля для agreement
  public id?: number; // ID в блокчейне
  public status: AgreementStatus;

  // Поля из блокчейна (soviet.hpp, таблица agreements3)
  public coopname?: IAgreementBlockchainData['coopname'];
  public username?: IAgreementBlockchainData['username'];
  public type?: IAgreementBlockchainData['type'];
  public program_id?: IAgreementBlockchainData['program_id'];
  public draft_id?: IAgreementBlockchainData['draft_id'];
  public version?: IAgreementBlockchainData['version'];
  public document?: ISignedDocument;
  public blockchain_status?: IAgreementBlockchainData['status']; // Статус из блокчейна
  public updated_at?: IAgreementBlockchainData['updated_at'];

  constructor(databaseData: IAgreementDatabaseData, blockchainData?: IAgreementBlockchainData) {
    // Вызываем конструктор базового класса с данными
    super(databaseData, AgreementStatus.REGISTERED);

    // Инициализируем специфичные поля
    this.id = blockchainData?.id ? Number(blockchainData.id) : undefined;
    this.status = this.mapBlockchainStatusToDomain(blockchainData?.status);

    // Инициализируем поля из блокчейна
    if (blockchainData) {
      this.coopname = blockchainData.coopname;
      this.username = blockchainData.username;
      this.type = blockchainData.type;
      this.program_id = blockchainData.program_id;
      this.draft_id = blockchainData.draft_id;
      this.version = blockchainData.version;
      this.document = blockchainData.document;
      this.blockchain_status = blockchainData.status;
      this.updated_at = blockchainData.updated_at;
    }
  }

  // Статические методы для получения ключей
  public static getPrimaryKey(): string {
    return AgreementDomainEntity.primary_key;
  }

  public static getSyncKey(): string {
    return AgreementDomainEntity.sync_key;
  }

  // Реализация IBlockchainSynchronizable
  getPrimaryKey(): string {
    return AgreementDomainEntity.primary_key;
  }

  getSyncKey(): string {
    return AgreementDomainEntity.sync_key;
  }

  getBlockNum(): number | undefined {
    return this.block_num;
  }

  updateFromBlockchain(blockchainData: IAgreementBlockchainData, blockNum: number, present = true): void {
    // Обновляем все поля из блокчейна
    this.coopname = blockchainData.coopname;
    this.username = blockchainData.username;
    this.type = blockchainData.type;
    this.program_id = blockchainData.program_id;
    this.draft_id = blockchainData.draft_id;
    this.version = blockchainData.version;
    this.document = blockchainData.document;
    this.blockchain_status = blockchainData.status;
    this.updated_at = blockchainData.updated_at;
    this.status = this.mapBlockchainStatusToDomain(blockchainData.status);
    this.block_num = blockNum;
    this.present = present;
  }

  private mapBlockchainStatusToDomain(blockchainStatus?: IAgreementBlockchainData['status']): AgreementStatus {
    if (!blockchainStatus || blockchainStatus === '') {
      return AgreementStatus.REGISTERED;
    }

    const statusValue = blockchainStatus.toString();

    switch (statusValue) {
      case 'confirmed':
        return AgreementStatus.CONFIRMED;
      case 'declined':
        return AgreementStatus.DECLINED;
      case 'registered':
      default:
        return AgreementStatus.REGISTERED;
    }
  }
}
