import { CycleDomainEntity } from '../../domain/entities/cycle.entity';
import { CycleTypeormEntity } from '../entities/cycle.typeorm-entity';
import type { ICycleDatabaseData } from '../../domain/interfaces/cycle-database.interface';

/**
 * Маппер для преобразования между доменной сущностью цикла и TypeORM сущностью
 */
export class CycleMapper {
  /**
   * Преобразование TypeORM сущности в доменную сущность
   */
  static toDomain(entity: CycleTypeormEntity): CycleDomainEntity {
    const databaseData: ICycleDatabaseData = {
      _id: entity._id,
      block_num: entity.block_num,
      name: entity.name,
      start_date: entity.start_date,
      end_date: entity.end_date,
      status: entity.status,
      _created_at: entity._created_at,
      _updated_at: entity._updated_at,
      present: entity.present,
    };

    return new CycleDomainEntity(databaseData);
  }

  /**
   * Преобразование доменной сущности в TypeORM сущность для создания
   */
  static toEntity(domain: Partial<CycleDomainEntity>): Partial<CycleTypeormEntity> {
    const entity: Partial<CycleTypeormEntity> = {};

    if (domain._id !== undefined) entity._id = domain._id;
    if (domain.name !== undefined) entity.name = domain.name;
    if (domain.start_date !== undefined) entity.start_date = domain.start_date;
    if (domain.end_date !== undefined) entity.end_date = domain.end_date;
    if (domain.status !== undefined) entity.status = domain.status;
    if (domain._created_at !== undefined) entity._created_at = domain._created_at as Date;
    if (domain._updated_at !== undefined) entity._updated_at = domain._updated_at as Date;
    return entity;
  }
}
