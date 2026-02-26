import { CommitStatus } from '../enums/commit-status.enum';
import type { ICommitDatabaseData } from '../interfaces/commit-database.interface';
import type { ICommitBlockchainData } from '../interfaces/commit-blockchain.interface';
import type { IBlockchainSynchronizable } from '~/shared/interfaces/blockchain-sync.interface';
import { BaseDomainEntity } from '~/shared/sync/entities/base-domain.entity';

/**
 * Интерфейс для данных Git-коммита
 */
export interface ICommitGitData {
  /** Тип источника (github, gitlab и т.д.) */
  source: string;
  /** Тип ресурса (pull_request, commit) */
  type: string;
  /** Полный URL источника */
  url: string;
  /** Владелец репозитория */
  owner: string;
  /** Название репозитория */
  repo: string;
  /** Ссылка на ветку/PR/коммит */
  ref: string;
  /** Извлеченный diff */
  diff: string;
  /** Время извлечения данных */
  extracted_at: string;
}

/**
 * Discriminated union для разных типов контента коммита
 */
export type CommitContentData =
  | { type: 'git'; data: ICommitGitData };

/**
 * Тип данных коммита - массив структурированных объектов с типом контента
 */
export type CommitData = CommitContentData[];

/**
 * Доменная сущность коммита
 *
 * Полностью агрегирует данные из двух источников:
 * - База данных: внутренний ID, ссылка на блокчейн
 * - Блокчейн: все данные коммита из таблицы commits
 */
export class CommitDomainEntity
  extends BaseDomainEntity<ICommitDatabaseData>
  implements IBlockchainSynchronizable, Partial<ICommitBlockchainData>
{
  // Статические поля ключей для поиска и синхронизации
  private static primary_key = 'id';
  private static sync_key = 'commit_hash';

  // Специфичные поля для commit
  public id?: number; // ID в блокчейне
  public status: CommitStatus;

  // Дополнительные поля из связанных сущностей
  public display_name?: string; // Отображаемое имя из участника

  // Поля из блокчейна (commits.hpp)
  public commit_hash: ICommitBlockchainData['commit_hash'];

  public coopname?: ICommitBlockchainData['coopname'];
  public username?: ICommitBlockchainData['username'];
  public project_hash?: ICommitBlockchainData['project_hash'];
  public amounts?: ICommitBlockchainData['amounts'];
  public description?: ICommitBlockchainData['description'];
  public meta?: ICommitBlockchainData['meta'];
  public data?: CommitData | null; // Обогащенные данные (diff, источник и т.д.)
  public blockchain_status?: ICommitBlockchainData['status']; // Статус из блокчейна
  public created_at?: ICommitBlockchainData['created_at'];

  /**
   * Конструктор для сборки композитной сущности
   *
   * @param databaseData - данные из базы данных
   * @param blockchainData - данные из блокчейна
   * @param additionalData - дополнительные данные из связанных сущностей
   */
  constructor(
    databaseData: ICommitDatabaseData,
    blockchainData?: ICommitBlockchainData,
    additionalData?: { display_name?: string }
  ) {
    // Вызываем конструктор базового класса с данными
    super(databaseData, CommitStatus.CREATED);

    // Специфичные поля для commit
    this.status = this.mapStatusToDomain(databaseData.status);
    this.commit_hash = databaseData.commit_hash.toLowerCase();
    this.data = databaseData.data; // Обогащенные данные из БД

    // Данные из блокчейна
    if (blockchainData) {
      if (this.commit_hash != blockchainData.commit_hash.toLowerCase()) throw new Error('Commit hash mismatch');

      this.id = Number(blockchainData.id);
      this.coopname = blockchainData.coopname;
      this.username = blockchainData.username;
      this.project_hash = blockchainData.project_hash.toLowerCase();
      this.commit_hash = blockchainData.commit_hash.toLowerCase();
      this.amounts = blockchainData.amounts;
      this.description = blockchainData.description;
      this.meta = blockchainData.meta;
      this.blockchain_status = blockchainData.status;
      this.created_at = blockchainData.created_at;

      // Синхронизация статуса с блокчейн данными
      this.status = this.mapStatusToDomain(blockchainData.status);
    }

    // Устанавливаем дополнительные поля
    if (additionalData) {
      this.display_name = additionalData.display_name;
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
    return CommitDomainEntity.primary_key;
  }

  /**
   * Получение ключа для синхронизации сущности в блокчейне и базе данных (статический метод)
   */
  public static getSyncKey(): string {
    return CommitDomainEntity.sync_key;
  }

  /**
   * Получение ключа для поиска сущности в блокчейне
   */
  getPrimaryKey(): string {
    return CommitDomainEntity.primary_key;
  }

  /**
   * Получение ключа для синхронизации сущности в блокчейне и базе данных
   */
  getSyncKey(): string {
    return CommitDomainEntity.sync_key;
  }

  /**
   * Обновление данных из блокчейна
   * Обновляет текущий экземпляр
   */
  updateFromBlockchain(blockchainData: ICommitBlockchainData, blockNum: number, present = true): void {
    // Сохраняем локальные поля БД, которых нет в блокчейне
    const localData = this.data;

    // Обновляем базовые поля через метод базового класса
    this.block_num = blockNum;
    this.present = present;

    // Обновляем специфичные поля из блокчейна
    Object.assign(this, blockchainData);

    // Восстанавливаем локальные поля
    this.data = localData;

    this.status = this.mapStatusToDomain(blockchainData.status);
    this.blockchain_status = blockchainData.status;

    // Нормализация hash полей
    if (this.commit_hash) this.commit_hash = this.commit_hash.toLowerCase();
    if (this.project_hash) this.project_hash = this.project_hash.toLowerCase();
  }

  /**
   * Маппинг статуса из блокчейна в доменный статус
   * Синхронизировано с константами из commits.hpp
   */
  private mapStatusToDomain(blockchainStatus?: string): CommitStatus {
    switch (blockchainStatus) {
      case 'created':
        return CommitStatus.CREATED;
      case 'approved':
        return CommitStatus.APPROVED;
      case 'declined':
        return CommitStatus.DECLINED;
      default:
        // По умолчанию считаем статус неопределенным

        return CommitStatus.UNDEFINED;
    }
  }
}
