import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, MoreThan, Repository } from 'typeorm';
import { EntityVersionRepository } from '../repositories/entity-version.repository';
import { InvalidatedEntityRepository } from '../repositories/invalidated-entity.repository';
import { InvalidatedEntityVersionRepository } from '../repositories/invalidated-entity-version.repository';
import { EntityVersionTypeormEntity } from '../entities/entity-version.typeorm-entity';
import { InvalidatedEntityTypeormEntity } from '../entities/invalidated-entity.typeorm-entity';
import { InvalidatedEntityVersionTypeormEntity } from '../entities/invalidated-entity-version.typeorm-entity';
import type { IBaseDatabaseData } from '../interfaces/base-database.interface';

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
  constructor(
    private readonly entityVersionRepository: EntityVersionRepository,
    private readonly invalidatedEntityRepository: InvalidatedEntityRepository,
    private readonly invalidatedEntityVersionRepository: InvalidatedEntityVersionRepository,
    @InjectDataSource() private readonly dataSource: DataSource
  ) {}

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
   * Восстановить версии сущностей после форка
   */
  async restoreVersionsAfterFork<TEntity extends IBaseDatabaseData>(
    repository: Repository<TEntity>,
    entityTable: string,
    forkBlockNum: number
  ): Promise<void> {
    // Получаем все версии для восстановления
    const versionsToRestore = await this.entityVersionRepository.getVersionsForRecovery(entityTable, forkBlockNum);

    // Группируем по entity_id, оставляя только последнюю версию для каждой сущности
    const latestVersions = new Map<string, any>();
    for (const version of versionsToRestore) {
      const existingVersion = latestVersions.get(version.entity_id);

      if (!existingVersion) {
        // Первая версия для этой сущности
        latestVersions.set(version.entity_id, version);
        continue;
      }

      // Сравниваем версии
      const shouldReplace = this.shouldReplaceVersion(existingVersion, version);

      if (shouldReplace) {
        latestVersions.set(version.entity_id, version);
      }
    }

    // Восстанавливаем каждую сущность из её последней версии
    for (const [entityId, version] of latestVersions) {
      // Проверяем, существует ли сущность
      const existingEntity = await repository.findOne({
        where: { _id: entityId } as any,
      });

      if (existingEntity) {
        // Обновляем существующую сущность данными из версии
        Object.assign(existingEntity, version.previous_data);
        await repository.save(existingEntity);
      } else {
        // Создаем новую сущность из версии
        const restoredEntity = repository.create(version.previous_data as any);
        await repository.save(restoredEntity);
      }
    }
  }

  /**
   * Определить, должна ли новая версия заменить существующую
   */
  private shouldReplaceVersion(existingVersion: any, newVersion: any): boolean {
    const existingBlockNum = existingVersion.block_num;
    const newBlockNum = newVersion.block_num;

    // Если обе версии имеют null block_num, сравниваем по created_at
    if (existingBlockNum === null && newBlockNum === null) {
      return newVersion.created_at > existingVersion.created_at;
    }

    // Если новая версия имеет null block_num, а существующая конкретный номер,
    // то новая версия (локальное изменение) должна иметь приоритет
    if (newBlockNum === null && existingBlockNum !== null) {
      return true;
    }

    // Если существующая версия имеет null block_num, а новая конкретный номер,
    // то сохраняем существующую (локальное изменение приоритетнее)
    if (existingBlockNum === null && newBlockNum !== null) {
      return false;
    }

    // Если обе версии имеют конкретные номера блоков, сравниваем их
    if (existingBlockNum !== null && newBlockNum !== null) {
      return newBlockNum > existingBlockNum;
    }

    // Fallback: сравниваем по created_at
    return newVersion.created_at > existingVersion.created_at;
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

      const rows = await txRepo.find({
        where: { block_num: MoreThan(forkBlockNum) } as any,
      });

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

      await txRepo.delete({ block_num: MoreThan(forkBlockNum) } as any);

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
