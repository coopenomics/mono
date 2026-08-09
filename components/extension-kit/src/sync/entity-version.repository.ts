import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { EntityVersionTypeormEntity } from './entity-version.typeorm-entity';

/**
 * Репозиторий для работы с версиями сущностей.
 * Используется для восстановления состояния при форках.
 */
@Injectable()
export class EntityVersionRepository {
  constructor(
    @InjectRepository(EntityVersionTypeormEntity)
    private readonly repository: Repository<EntityVersionTypeormEntity>
  ) {}

  /**
   * Сохранить предыдущую версию сущности
   */
  async saveVersion(
    entityTable: string,
    entityId: string,
    previousData: Record<string, any>,
    blockNum: number | null,
    changeType: string,
    metadata?: Record<string, any>
  ): Promise<EntityVersionTypeormEntity> {
    const version = this.repository.create({
      entity_table: entityTable,
      entity_id: entityId,
      previous_data: previousData,
      block_num: blockNum,
      change_type: changeType,
      metadata,
    });

    return await this.repository.save(version);
  }

  /**
   * Получить последнюю версию сущности до указанного блока
   */
  async getLastVersionBeforeBlock(
    entityTable: string,
    entityId: string,
    blockNum: number
  ): Promise<EntityVersionTypeormEntity | null> {
    return await this.repository
      .createQueryBuilder('version')
      .where('version.entity_table = :entityTable', { entityTable })
      .andWhere('version.entity_id = :entityId', { entityId })
      .andWhere('version.block_num <= :blockNum', { blockNum })
      .orderBy('version.block_num', 'DESC')
      .addOrderBy('version.created_at', 'DESC')
      .getOne();
  }

  /**
   * Удалить все версии после указанного блока (локальные изменения остаются)
   */
  async deleteVersionsAfterBlock(blockNum: number): Promise<number> {
    const result = await this.repository
      .createQueryBuilder()
      .delete()
      .from(EntityVersionTypeormEntity)
      .where('block_num > :blockNum AND block_num IS NOT NULL', { blockNum })
      .execute();

    return result.affected || 0;
  }

  /**
   * Получить все версии для сущностей, которые нужно восстановить
   */
  async getVersionsForRecovery(entityTable: string, maxBlockNum: number): Promise<EntityVersionTypeormEntity[]> {
    return await this.repository
      .createQueryBuilder('version')
      .where('version.entity_table = :entityTable', { entityTable })
      .andWhere('(version.block_num <= :maxBlockNum OR version.block_num IS NULL)', { maxBlockNum })
      .orderBy('version.entity_table', 'ASC')
      .addOrderBy('version.entity_id', 'ASC')
      .addOrderBy('version.block_num', 'DESC')
      .addOrderBy('version.created_at', 'DESC')
      .getMany();
  }

  /**
   * Очистить версии для указанной сущности
   */
  async clearVersionsForEntity(entityTable: string, entityId: string): Promise<number> {
    const result = await this.repository
      .createQueryBuilder()
      .delete()
      .from(EntityVersionTypeormEntity)
      .where('entity_table = :entityTable', { entityTable })
      .andWhere('entity_id = :entityId', { entityId })
      .execute();

    return result.affected || 0;
  }
}
