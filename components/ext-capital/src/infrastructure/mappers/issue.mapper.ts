import { IssueDomainEntity } from '../../domain/entities/issue.entity';
import { IssueTypeormEntity } from '../entities/issue.typeorm-entity';
import type { IIssueDatabaseData } from '../../domain/interfaces/issue-database.interface';

/**
 * Маппер для преобразования между доменной сущностью задачи и TypeORM сущностью
 */
export class IssueMapper {
  /**
   * Преобразование TypeORM сущности в доменную сущность
   */
  static toDomain(entity: IssueTypeormEntity): IssueDomainEntity {
    const databaseData: IIssueDatabaseData = {
      _id: entity._id,
      id: entity.id,
      block_num: entity.block_num,
      issue_hash: entity.issue_hash,
      coopname: entity.coopname,
      title: entity.title,
      description: entity.description,
      priority: entity.priority,
      status: entity.status,
      estimate: entity.estimate,
      sort_order: entity.sort_order,
      created_by: entity.created_by,
      creators: entity.creators,
      submaster: entity.submaster,
      project_hash: entity.project_hash,
      cycle_id: entity.cycle_id,
      metadata: entity.metadata,
      _created_at: entity._created_at,
      _updated_at: entity._updated_at,
      present: entity.present,
    };

    return new IssueDomainEntity(databaseData);
  }

  /**
   * Преобразование доменной сущности в TypeORM сущность для создания
   */
  static toEntity(domain: Partial<IssueDomainEntity>): Partial<IssueTypeormEntity> {
    const entity: Partial<IssueTypeormEntity> = {};
    // Object.assign(entity, domain);
    if (domain._id !== undefined) entity._id = domain._id;
    if (domain.id !== undefined) entity.id = domain.id;
    if (domain.issue_hash !== undefined) entity.issue_hash = domain.issue_hash;
    if (domain.coopname !== undefined) entity.coopname = domain.coopname;
    if (domain.title !== undefined) entity.title = domain.title;
    if (domain.description !== undefined) entity.description = domain.description;
    if (domain.priority !== undefined) entity.priority = domain.priority;
    if (domain.status !== undefined) entity.status = domain.status;
    if (domain.estimate !== undefined) entity.estimate = domain.estimate;
    if (domain.sort_order !== undefined) entity.sort_order = domain.sort_order;
    if (domain.created_by !== undefined) entity.created_by = domain.created_by;
    if (domain.creators !== undefined) entity.creators = domain.creators;
    if (domain.submaster !== undefined) entity.submaster = domain.submaster;
    if (domain.project_hash !== undefined) entity.project_hash = domain.project_hash;
    if (domain.cycle_id !== undefined) entity.cycle_id = domain.cycle_id;
    if (domain.metadata !== undefined) entity.metadata = domain.metadata;
    if (domain._created_at !== undefined) entity._created_at = domain._created_at as Date;
    if (domain._updated_at !== undefined) entity._updated_at = domain._updated_at as Date;
    if (domain.present !== undefined) entity.present = domain.present;
    return entity;
  }
}
