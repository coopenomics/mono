import { Inject, Injectable } from '@nestjs/common';
// Из typeorm берём только типы: pnpm может дать пакету второй экземпляр
// модуля, и значения-операторы (`MoreThan`, `In`) не прошли бы `instanceof
// FindOperator` из копии контроллера. Условия собираем query builder'ом.
import type { DataSource, Repository } from 'typeorm';
import { EntityVersionRepository } from './entity-version.repository';
import { InvalidatedEntityRepository } from './invalidated-entity.repository';
import { InvalidatedEntityVersionRepository } from './invalidated-entity-version.repository';
import { EntityVersionTypeormEntity } from './entity-version.typeorm-entity';
import { InvalidatedEntityTypeormEntity } from './invalidated-entity.typeorm-entity';
import { InvalidatedEntityVersionTypeormEntity } from './invalidated-entity-version.typeorm-entity';
import type { IBaseDatabaseData } from './base-database.interface';

/**
 * Сервис для версионирования сущностей.
 * Автоматически сохраняет предыдущие версии при изменениях и восстанавливает их при форках.
 *
 * Story 4.4: расширен двумя архивными методами — archiveAndDeleteLiveAfterFork /
 * archiveAndDeleteVersionsAfterFork. Используются из AbstractEntitySyncService.handleFork
 * через делегацию BaseBlockchainRepository (см. base-blockchain.repository.ts).
 */
@Injectable()
export class EntityVersioningService {
  // Токены зависимостей указаны явно, а не выведены из типов: пакет собирается
  // unbuild/esbuild, а esbuild не умеет `emitDecoratorMetadata`. Без `@Inject`
  // Nest не нашёл бы `design:paramtypes` и упал бы на инстанцировании сервиса.
  constructor(
    @Inject(EntityVersionRepository) private readonly entityVersionRepository: EntityVersionRepository,
    @Inject(InvalidatedEntityRepository) private readonly invalidatedEntityRepository: InvalidatedEntityRepository,
    @Inject(InvalidatedEntityVersionRepository)
    private readonly invalidatedEntityVersionRepository: InvalidatedEntityVersionRepository
  ) {}

  /**
   * Соединение берём у репозитория, а не инъекцией `@InjectDataSource()`:
   * у пакета и контроллера разные экземпляры `@nestjs/typeorm`, и токен
   * источника данных не совпал бы — Nest не нашёл бы провайдера.
   */
  private get dataSource(): DataSource {
    return this.entityVersionRepository.dataSource;
  }

  /**
   * Сохранить версию сущности перед её изменением
   */
  async saveVersionBeforeUpdate<TEntity extends IBaseDatabaseData>(
    repository: Repository<TEntity>,
    entityTable: string,
    updatedEntity: Partial<TEntity>,
    blockNum: number | null,
    changeType: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    // Находим текущую версию в базе
    const existingEntity = await repository.findOne({
      where: { _id: updatedEntity._id } as any,
    });

    if (!existingEntity) {
      // Новая сущность - нечего версионировать
      return;
    }

    // Сохраняем предыдущую версию
    await this.entityVersionRepository.saveVersion(
      entityTable,
      existingEntity._id,
      { ...existingEntity }, // Глубокая копия предыдущих данных
      blockNum,
      changeType,
      metadata
    );
  }

  /**
   * Вернуть сущности к состоянию на блоке форка.
   *
   * Версия хранит состояние сущности ДО изменения и блок самого изменения.
   * После форка недействительны изменения с блоком больше блока форка, поэтому
   * для каждой сущности берётся самое раннее такое изменение: состояние перед
   * ним и есть состояние на блоке форка. Сущность без изменений после форка
   * остаётся как есть.
   *
   * До 04.10.2026 брались версии с блоком НЕ больше блока форка, и живая
   * запись перезаписывалась состоянием перед её последним изменением: любой
   * форк откатывал на шаг назад все записи с историей, включая те, которых он
   * не касался. Так у пайщика из зеркала пропадала подпись программной оферты
   * (находка полного прогона внешнего слоя, C28-85).
   */
  async restoreVersionsAfterFork<TEntity extends IBaseDatabaseData>(
    repository: Repository<TEntity>,
    entityTable: string,
    forkBlockNum: number
  ): Promise<void> {
    // Изменения после форка, от ранних к поздним.
    const invalidated = await this.entityVersionRepository.getVersionsForRecovery(entityTable, forkBlockNum);

    const firstInvalidated = new Map<string, EntityVersionTypeormEntity>();
    for (const version of invalidated) {
      if (!firstInvalidated.has(version.entity_id)) firstInvalidated.set(version.entity_id, version);
    }

    for (const [entityId, version] of firstInvalidated) {
      const state = version.previous_data as Record<string, unknown> | null;
      if (!state) continue;

      // Сущность появилась уже после форка: на блоке форка её не было, и
      // возвращать нечего — живую запись убрал архив.
      const stateBlock = state.block_num;
      if (stateBlock !== null && stateBlock !== undefined && Number(stateBlock) > forkBlockNum) continue;

      const existingEntity = await repository.findOne({
        where: { _id: entityId } as any,
      });

      if (existingEntity) {
        Object.assign(existingEntity, state);
        await repository.save(existingEntity);
      } else {
        const restoredEntity = repository.create(state as any);
        await repository.save(restoredEntity);
      }
    }
  }

  /**
   * Очистить версии после успешного восстановления
   */
  async clearVersionsAfterBlock(blockNum: number): Promise<number> {
    return await this.entityVersionRepository.deleteVersionsAfterBlock(blockNum);
  }

  /**
   * Story 4.4: атомарно перенести live-ряды WHERE block_num > forkBlockNum в архив
   * `invalidated_entities` и удалить их из исходной таблицы. Возвращает количество
   * перенесённых рядов. Транзакция через DataSource — INSERT и DELETE либо оба
   * успешны, либо оба откатываются.
   *
   * Заменяет прежнюю пару findByBlockNumGreaterThan + deleteByBlockNumGreaterThan
   * в hot-path handleFork (sequence сейчас: archive → restoreFromVersions →
   * archiveVersions).
   */
  async archiveAndDeleteLiveAfterFork<TEntity extends IBaseDatabaseData>(
    repository: Repository<TEntity>,
    entityTable: string,
    forkBlockNum: number,
    forkEventId?: string | null
  ): Promise<number> {
    return this.dataSource.transaction(async (manager) => {
      const txRepo = manager.getRepository(repository.target as any) as Repository<TEntity>;
      const txInvalidated = manager.getRepository(InvalidatedEntityTypeormEntity);

      const rows = await txRepo
        .createQueryBuilder('e')
        .where('e.block_num > :forkBlockNum', { forkBlockNum })
        .getMany();

      if (rows.length === 0) return 0;

      const archiveRecords = rows.map((row) =>
        txInvalidated.create({
          entity_table: entityTable,
          entity_id: (row as any)._id,
          data: { ...row },
          invalidated_by_block: forkBlockNum,
          fork_event_id: forkEventId ?? null,
        })
      );
      await txInvalidated.save(archiveRecords);

      await txRepo
        .createQueryBuilder()
        .delete()
        .where('block_num > :forkBlockNum', { forkBlockNum })
        .execute();

      return rows.length;
    });
  }

  /**
   * Story 4.4: атомарно перенести entity_versions WHERE entity_table=... AND block_num > forkBlockNum
   * в архив `invalidated_entity_versions` и удалить их из entity_versions.
   * Возвращает количество перенесённых рядов.
   *
   * Запускается ПОСЛЕ restoreFromVersions — иначе restore не сможет прочитать
   * ещё-живые версии.
   */
  async archiveAndDeleteVersionsAfterFork(
    entityTable: string,
    forkBlockNum: number,
    forkEventId?: string | null
  ): Promise<number> {
    return this.dataSource.transaction(async (manager) => {
      const txVersions = manager.getRepository(EntityVersionTypeormEntity);
      const txArchive = manager.getRepository(InvalidatedEntityVersionTypeormEntity);

      const versions = await txVersions
        .createQueryBuilder('v')
        .where('v.entity_table = :entityTable', { entityTable })
        .andWhere('v.block_num > :forkBlockNum', { forkBlockNum })
        .getMany();

      if (versions.length === 0) return 0;

      const archiveRecords = versions.map((v) =>
        txArchive.create({
          entity_table: v.entity_table,
          entity_id: v.entity_id,
          previous_data: v.previous_data,
          original_block_num: v.block_num ?? null,
          invalidated_by_block: forkBlockNum,
          fork_event_id: forkEventId ?? null,
          change_type: v.change_type,
          metadata: v.metadata ?? null,
        })
      );
      await txArchive.save(archiveRecords);

      const ids = versions.map((v) => v.id);
      await txVersions
        .createQueryBuilder()
        .delete()
        .from(EntityVersionTypeormEntity)
        .whereInIds(ids)
        .execute();

      return versions.length;
    });
  }
}
