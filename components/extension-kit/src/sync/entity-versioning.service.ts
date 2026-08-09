import { Inject, Injectable } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { EntityVersionRepository } from './entity-version.repository';
import type { IBaseDatabaseData } from './base-database.interface';

/**
 * Сервис для версионирования сущностей.
 * Автоматически сохраняет предыдущие версии при изменениях и восстанавливает их при форках.
 */
@Injectable()
export class EntityVersioningService {
  // Токен зависимости указан явно, а не выведен из типа: пакет собирается
  // unbuild/esbuild, а esbuild не умеет `emitDecoratorMetadata`. Без `@Inject`
  // Nest не нашёл бы `design:paramtypes` и упал бы на инстанцировании сервиса.
  constructor(@Inject(EntityVersionRepository) private readonly entityVersionRepository: EntityVersionRepository) {}

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
}
