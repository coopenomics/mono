import type { IDelta } from './delta';

/**
 * Интерфейс для данных с привязкой к блоку
 */
export interface IBlockchainSyncData {
  /** Номер блока в котором произошло изменение */
  block_num: number;
}

/**
 * Интерфейс для сущностей, которые могут быть синхронизированы с блокчейном
 */
export interface IBlockchainSynchronizable {
  /** Номер блока последнего обновления */
  getBlockNum(): number | undefined;

  /** Ключ для поиска сущности в блокчейне */
  getPrimaryKey(): string;

  /** Ключ для синхронизации сущности в блокчейне и базе данных */
  getSyncKey(): string;

  /** Обновление данных из блокчейна */
  updateFromBlockchain(blockchainData: any, blockNum: number, present?: boolean): void;
}

/**
 * Интерфейс для маппинга дельт блокчейна в доменные данные
 */
export interface IBlockchainDeltaMapper<TBlockchainData = any, _TDomainEntity = any> {
  /** Маппинг данных дельты в блокчейн-данные */
  mapDeltaToBlockchainData(delta: IDelta): TBlockchainData | null;

  /** Получение идентификатора сущности из дельты */
  extractSyncValue(delta: IDelta): string;

  /** Получение ключа для синхронизации сущности в блокчейне и базе данных */
  extractSyncKey(): string;

  /** Получение всех возможных паттернов событий  */
  getAllEventPatterns(): string[];

  /** Получение всех поддерживаемых имен таблиц */
  getSupportedTableNames(): string[];

  /** Получение всех поддерживаемых имен контрактов */
  getSupportedContractNames(): string[];
}

/**
 * Интерфейс для репозиториев с поддержкой синхронизации блокчейна
 */
export interface IBlockchainSyncRepository<TEntity extends IBlockchainSynchronizable> {
  /** Найти сущность по кастомному ключу синхронизации */
  findBySyncKey(syncKey: string, syncValue: string): Promise<TEntity | null>;

  /** Найти сущности с номером блока больше указанного */
  findByBlockNumGreaterThan(blockNum: number): Promise<TEntity[]>;

  /** Создание и валидация сущности без сохранения в базу данных */
  create(entity: TEntity): Promise<any>;

  /** Сохранение созданной сущности в базу данных */
  saveCreated(entity: any): Promise<TEntity>;

  /** Сохранить сущность */
  save(entity: TEntity): Promise<TEntity>;

  /** Обновить сущность */
  update(entity: TEntity): Promise<TEntity>;

  /** Создать сущность если не существует */
  createIfNotExists(blockchainData: any, blockNum: number, present?: boolean): Promise<TEntity>;

  /** Удалить сущности с номером блока больше указанного (для обработки форков) */
  deleteByBlockNumGreaterThan(blockNum: number): Promise<void>;

  /** Восстановить сущности из версий после форка */
  restoreFromVersions?(forkBlockNum: number): Promise<void>;

  /**
   * Story 4.4: атомарно перенести live-сущности WHERE block_num > forkBlockNum в архив
   * (invalidated_entities) и удалить из исходной таблицы. Возвращает count.
   */
  archiveInvalidatedSince?(forkBlockNum: number, forkEventId?: string | null): Promise<number>;

  /**
   * Story 4.4: атомарно перенести версии этой entity_table WHERE block_num > forkBlockNum
   * в архив (invalidated_entity_versions) и удалить из entity_versions. Возвращает count.
   */
  archiveInvalidatedVersionsSince?(forkBlockNum: number, forkEventId?: string | null): Promise<number>;
}

/**
 * Результат синхронизации сущности
 */
export interface ISyncResult {
  /** Была ли сущность создана */
  created: boolean;

  /** Была ли сущность обновлена */
  updated: boolean;

  /** Идентификатор сущности */
  blockchainId: string;

  /** Номер блока */
  blockNum: number;
}
