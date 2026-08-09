import { Injectable } from '@nestjs/common';
import type { IDelta } from './delta';
import type { ISyncLogger } from './sync-logger';
import type {
  IBlockchainSynchronizable,
  IBlockchainDeltaMapper,
  IBlockchainSyncRepository,
  ISyncResult,
} from './blockchain-sync.interface';

/**
 * Абстрактный сервис для синхронизации сущностей с блокчейном
 *
 * Предоставляет базовую логику для:
 * - Обработки дельт блокчейна
 * - Создания/обновления сущностей
 * - Обработки форков
 */
@Injectable()
export abstract class AbstractEntitySyncService<TEntity extends IBlockchainSynchronizable, TBlockchainData = any> {
  protected abstract readonly entityName: string;

  constructor(
    protected readonly repository: IBlockchainSyncRepository<TEntity>,
    protected readonly mapper: IBlockchainDeltaMapper<TBlockchainData>,
    protected readonly logger: ISyncLogger
  ) {
    this.logger.setContext(`${this.constructor.name}`);
  }

  /**
   * Обработка дельты блокчейна
   */
  async processDelta(delta: IDelta): Promise<ISyncResult | null> {
    try {
      this.logger.debug(`Processing ${this.entityName} delta for table ${delta.table} with key ${delta.primary_key}`);

      // Извлекаем ID сущности из дельты
      const syncValue = this.mapper.extractSyncValue(delta);

      // Извлекаем ключ для синхронизации сущности в блокчейне и базе данных
      const syncKey = this.mapper.extractSyncKey();

      // Маппинг дельты в блокчейн-данные
      const blockchainData = this.mapper.mapDeltaToBlockchainData(delta);
      if (!blockchainData) {
        this.logger.warn(`Failed to map delta to blockchain data for ${this.entityName} ${syncValue}`);
        return null;
      }

      const blockNum = Number(delta.block_num);
      const present = delta.present !== false;

      // Обработка создания/обновления сущности
      return await this.handleSyncDelta(syncKey, syncValue, blockchainData, blockNum, present);
    } catch (error: any) {
      this.logger.error(`Error processing ${this.entityName} delta: ${error.message}`, error.stack);
      // Не перебрасываем ошибку, чтобы не падало приложение
      return null;
    }
  }

  /**
   * Обработка создания/обновления сущности
   */
  public async handleSyncDelta(
    syncKey: string,
    syncValue: string,
    blockchainData: TBlockchainData,
    blockNum: number,
    present = true
  ): Promise<ISyncResult> {
    // Ищем существующую сущность по кастомному ключу синхронизации
    const existingEntity = await this.repository.findBySyncKey(syncKey, syncValue);
    if (existingEntity) {
      // Проверяем, не является ли это устаревшим обновлением
      const currentBlockNum = existingEntity.getBlockNum();
      if (currentBlockNum && blockNum < currentBlockNum) {
        this.logger.debug(
          `Skipping outdated update for ${this.entityName} ${syncValue}: block ${blockNum} <= ${currentBlockNum}`
        );
        return {
          created: false,
          updated: false,
          blockchainId: syncValue,
          blockNum: currentBlockNum,
        };
      }

      // Обновляем существующую сущность
      existingEntity.updateFromBlockchain(blockchainData, blockNum, present);

      await this.repository.update(existingEntity);

      this.logger.debug(`Обновлен ${this.entityName} ${syncValue} в блоке ${blockNum}`);

      return {
        created: false,
        updated: true,
        blockchainId: syncValue,
        blockNum,
      };
    } else {
      // Создаем новую сущность
      await this.repository.createIfNotExists(blockchainData, blockNum, present);

      this.logger.debug(`Создан ${this.entityName} ${syncValue} в блоке ${blockNum}`);

      return {
        created: true,
        updated: false,
        blockchainId: syncValue,
        blockNum,
      };
    }
  }

  /**
   * Обработка удаления сущности
   */
  private async handleEntityDeletion(syncValue: string, blockNum: number): Promise<ISyncResult | null> {
    // Для большинства случаев в EOSIO удаление записи означает
    // что сущность была перемещена в другое состояние
    // Конкретная логика может быть переопределена в наследниках
    this.logger.debug(`Entity ${this.entityName} ${syncValue} was deleted at block ${blockNum}`);

    return {
      created: false,
      updated: false,
      blockchainId: syncValue,
      blockNum,
    };
  }

  /**
   * Обработка форка - удаление данных после указанного блока
   */
  async handleFork(forkBlockNum: number): Promise<void> {
    try {
      this.logger.log(`Handling fork for ${this.entityName} at block ${forkBlockNum}`);

      // Находим все сущности, обновленные после форка
      const affectedEntities = await this.repository.findByBlockNumGreaterThan(forkBlockNum);

      this.logger.debug(
        `Found ${affectedEntities.length} ${this.entityName} entities affected by fork at block ${forkBlockNum}`
      );

      // Удаляем затронутые форком сущности
      await this.repository.deleteByBlockNumGreaterThan(forkBlockNum);

      this.logger.log(`Removed ${affectedEntities.length} ${this.entityName} entities after fork at block ${forkBlockNum}`);

      // Восстанавливаем сущности из версий
      if (this.repository.restoreFromVersions) {
        await this.repository.restoreFromVersions(forkBlockNum);
        this.logger.log(`Restored ${this.entityName} entities from versions after fork at block ${forkBlockNum}`);
      }

      // Вызываем метод для дополнительных действий после форка
      await this.afterForkProcessing(forkBlockNum, affectedEntities);
    } catch (error: any) {
      this.logger.error(`Error handling fork for ${this.entityName}: ${error.message}`, error.stack);
      // Не перебрасываем ошибку, чтобы не падало приложение
      return;
    }
  }

  /**
   * Дополнительные действия после обработки форка
   * Может быть переопределен в наследниках
   */
  protected async afterForkProcessing(_forkBlockNum: number, _affectedEntities: TEntity[]): Promise<void> {
    // По умолчанию ничего не делаем
  }

  /**
   * Получение всех возможных имен событий для подписки
   */
  getAllEventPatterns(): string[] {
    return this.mapper.getAllEventPatterns();
  }

  /**
   * Получение всех поддерживаемых таблиц и контрактов для логирования
   */
  getSupportedVersions(): { contracts: string[]; tables: string[] } {
    return {
      contracts: this.mapper.getSupportedContractNames(),
      tables: this.mapper.getSupportedTableNames(),
    };
  }

  /**
   * Получение имени события для подписки на форки
   */
  getForkEventPattern(): string {
    return 'fork::*';
  }
}
