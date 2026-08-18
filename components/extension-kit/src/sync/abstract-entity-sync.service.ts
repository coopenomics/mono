import { Injectable } from '@nestjs/common';
import type { IDelta } from './delta';
import type { ISyncLogger } from './sync-logger';
import type {
  IBlockchainSynchronizable,
  IBlockchainDeltaMapper,
  IBlockchainSyncRepository,
  ISyncResult,
} from './blockchain-sync.interface';
import { FORK_AWARE_MARKER, type IForkAwareSyncer } from './fork/fork-aware-syncer.interface';
import { UnsupportedContractVersionError } from './errors/unsupported-contract-version.error';
// Режим обработки неизвестной версии контракта задаёт composition root: в
// пакете конфига контроллера нет, а поведение — свойство стенда, не кооператива.
import { syncPolicy } from './sync-policy';

/**
 * Абстрактный сервис для синхронизации сущностей с блокчейном
 *
 * Предоставляет базовую логику для:
 * - Обработки дельт блокчейна
 * - Создания/обновления сущностей
 * - Обработки форков (Story 4.1: реализует IForkAwareSyncer — ForkRegistryService
 *   собирает наследников через DiscoveryService по symbol-маркеру и обходит
 *   sequential при форке)
 */
@Injectable()
export abstract class AbstractEntitySyncService<TEntity extends IBlockchainSynchronizable, TBlockchainData = any>
  implements IForkAwareSyncer
{
  protected abstract readonly entityName: string;

  /**
   * Symbol-маркер для ForkRegistryService (Story 4.1). Все 20+ наследников
   * автоматически попадают в реестр через bootstrap-сканирование Discovery —
   * без правок их onModuleInit.
   */
  readonly [FORK_AWARE_MARKER] = true;

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
        // Story 6.5: silent loss заменён на audit-trail error. В strict-mode дополнительно
        // throw UnsupportedContractVersionError — парсер не ACK'нет дельту, dead-letter сработает.
        const ctx = {
          contract: (delta as any).contract ?? (delta as any).code,
          table: (delta as any).table,
          primary_key: (delta as any).primary_key,
          block_num: Number((delta as any).block_num),
        };
        this.logger.error(
          `UNSUPPORTED_CONTRACT_VERSION: mapDeltaToBlockchainData returned null for ${this.entityName} ${syncValue}`,
          { entity: this.entityName, syncValue, ...ctx }
        );
        if (syncPolicy().unsupportedVersionStrict) {
          throw new UnsupportedContractVersionError(this.entityName, ctx);
        }
        return null;
      }

      const blockNum = Number(delta.block_num);
      const present = delta.present !== false;

      // Обработка создания/обновления сущности
      return await this.handleSyncDelta(syncKey, syncValue, blockchainData, blockNum, present);
    } catch (error: any) {
      // Story 6.5: UnsupportedContractVersionError пробрасываем дальше, чтобы парсер
      // не ACK'нул дельту в strict-mode.
      if (error instanceof UnsupportedContractVersionError) throw error;
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
   * Обработка форка — архивирование снесённых сущностей + восстановление из versions
   * + архивирование инвалидированных версий.
   *
   * Story 4.1: ошибки больше НЕ глотаются — обязательный re-throw для контракта
   * sequential ForkRegistry.runAll (INV-T03). Если rollback упадёт — parser2 не
   * ACK'нет fork-event, повторная доставка пересыграет цепочку. Уже отработавшие
   * syncer'ы в цепи будут no-op (versions уже подняты), сбойный — попробует ещё раз.
   *
   * Story 4.4: hard-delete заменён на «архив + delete» атомарно. Порядок:
   *   1) archiveInvalidatedSince — live-ряды WHERE block_num > N переезжают в
   *      invalidated_entities, оригинал удаляется (одна транзакция).
   *   2) restoreFromVersions — поднять previous_data из ещё-живых entity_versions.
   *   3) archiveInvalidatedVersionsSince — entity_versions WHERE entity_table=... AND
   *      block_num > N переезжают в invalidated_entity_versions, оригинал удаляется.
   *      Запускается ПОСЛЕ restore, иначе restore не сможет прочитать живые версии.
   * Если репо не реализует archive методы (off-chain) — graceful no-op + fallback
   * на старую findByBlockNumGreaterThan/deleteByBlockNumGreaterThan для бэк-совместимости.
   */
  async handleFork(forkBlockNum: number, forkEventId?: string | null): Promise<void> {
    this.logger.log(`Handling fork for ${this.entityName} at block ${forkBlockNum} (eventId=${forkEventId ?? 'n/a'})`);

    let archivedLive = 0;
    if (this.repository.archiveInvalidatedSince) {
      archivedLive = await this.repository.archiveInvalidatedSince(forkBlockNum, forkEventId);
      this.logger.log(
        `Архивировано ${archivedLive} live-рядов ${this.entityName} на форке ${forkBlockNum}`
      );
    } else {
      // Бэк-совместимость для off-chain репозиториев без архива (Story 4.3 allowlist)
      const affected = await this.repository.findByBlockNumGreaterThan(forkBlockNum);
      await this.repository.deleteByBlockNumGreaterThan(forkBlockNum);
      archivedLive = affected.length;
      this.logger.warn(
        `${this.entityName}: archiveInvalidatedSince не реализован — fallback на hard-delete (${archivedLive} рядов)`
      );
    }

    if (this.repository.restoreFromVersions) {
      await this.repository.restoreFromVersions(forkBlockNum);
      this.logger.log(`Restored ${this.entityName} entities from versions after fork at block ${forkBlockNum}`);
    }

    if (this.repository.archiveInvalidatedVersionsSince) {
      const archivedVersions = await this.repository.archiveInvalidatedVersionsSince(forkBlockNum, forkEventId);
      this.logger.log(
        `Архивировано ${archivedVersions} версий ${this.entityName} на форке ${forkBlockNum}`
      );
    }

    await this.afterForkProcessing(forkBlockNum, []);
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
