import { StoryDomainEntity } from '../../domain/entities/story.entity';
import { StoryTypeormEntity } from '../entities/story.typeorm-entity';
import type { IStoryDatabaseData } from '../../domain/interfaces/story-database.interface';

/**
 * Маппер для преобразования между доменной сущностью истории и TypeORM сущностью
 */
export class StoryMapper {
  /**
   * Преобразование TypeORM сущности в доменную сущность
   */
  static toDomain(entity: StoryTypeormEntity): StoryDomainEntity {
    const databaseData: IStoryDatabaseData = {
      _id: entity._id,
      story_hash: entity.story_hash,
      coopname: entity.coopname,
      title: entity.title,
      description: entity.description,
      status: entity.status,
      project_hash: entity.project_hash,
      // Нормализация: пустая строка преобразуется в undefined
      issue_hash: entity.issue_hash && entity.issue_hash.trim() !== '' ? entity.issue_hash : undefined,
      created_by: entity.created_by,
      sort_order: entity.sort_order,
      block_num: entity.block_num,
      present: entity.present,
      _created_at: entity._created_at,
      _updated_at: entity._updated_at,
    };

    return new StoryDomainEntity(databaseData);
  }

  /**
   * Преобразование доменной сущности в TypeORM сущность
   */
  static toEntity(domain: StoryDomainEntity): Partial<StoryTypeormEntity> {
    const entity: Partial<StoryTypeormEntity> = {
      _id: domain._id,
      story_hash: domain.story_hash,
      coopname: domain.coopname,
      title: domain.title,
      description: domain.description,
      status: domain.status,
      project_hash: domain.project_hash,
      // Нормализация: undefined/пустая строка преобразуется в undefined для правильной работы с БД
      issue_hash: domain.issue_hash && domain.issue_hash.trim() !== '' ? domain.issue_hash : undefined,
      created_by: domain.created_by,
      sort_order: domain.sort_order,
      block_num: domain.block_num,
      present: domain.present,
      _created_at: domain._created_at,
      _updated_at: domain._updated_at,
    };

    return entity;
  }
}
