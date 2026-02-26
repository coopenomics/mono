import { ProjectPropertyDomainEntity } from '../../domain/entities/project-property.entity';
import { ProjectPropertyTypeormEntity } from '../entities/project-property.typeorm-entity';
import type { IProjectPropertyDatabaseData } from '../../domain/interfaces/project-property-database.interface';
import type { IProjectPropertyBlockchainData } from '../../domain/interfaces/project-property-blockchain.interface';
import type { RequireFields } from '~/shared/utils/require-fields';

type toEntityDatabasePart = RequireFields<Partial<ProjectPropertyTypeormEntity>, keyof IProjectPropertyDatabaseData>;
type toEntityBlockchainPart = RequireFields<Partial<ProjectPropertyTypeormEntity>, keyof IProjectPropertyBlockchainData>;

type toDomainDatabasePart = RequireFields<Partial<ProjectPropertyDomainEntity>, keyof IProjectPropertyDatabaseData>;
type toDomainBlockchainPart = RequireFields<Partial<ProjectPropertyDomainEntity>, keyof IProjectPropertyBlockchainData>;

/**
 * Маппер для преобразования между доменной сущностью проектного имущественного взноса и TypeORM сущностью
 */
export class ProjectPropertyMapper {
  /**
   * Преобразование TypeORM сущности в доменную сущность
   */
  static toDomain(entity: ProjectPropertyTypeormEntity): ProjectPropertyDomainEntity {
    const databaseData: toDomainDatabasePart = {
      _id: entity._id,
      block_num: entity.block_num,
      present: entity.present,
      property_hash: entity.property_hash,
      status: entity.status,
      blockchain_status: entity.blockchain_status,
      _created_at: entity._created_at,
      _updated_at: entity._updated_at,
    };

    let blockchainData: toDomainBlockchainPart | undefined;

    if (entity[ProjectPropertyDomainEntity.getPrimaryKey()]) {
      // Используем данные из TypeORM сущности
      blockchainData = {
        id: entity.id,
        coopname: entity.coopname,
        username: entity.username,
        status: entity.status,
        project_hash: entity.project_hash,
        property_hash: entity.property_hash,
        property_amount: entity.property_amount,
        property_description: entity.property_description,
        created_at: entity.created_at.toISOString(),
      };
    }

    return new ProjectPropertyDomainEntity(databaseData, blockchainData);
  }

  /**
   * Преобразование доменной сущности в TypeORM сущность для создания
   */
  static toEntity(domain: ProjectPropertyDomainEntity): Partial<ProjectPropertyTypeormEntity> {
    const dbPart: toEntityDatabasePart = {
      _id: domain._id,
      block_num: domain.block_num ?? 0,
      present: domain.present,
      property_hash: domain.property_hash,
      status: domain.status,
      blockchain_status: domain.blockchain_status as string,
      _created_at: domain._created_at as Date,
      _updated_at: domain._updated_at as Date,
    };

    let blockchainPart: toEntityBlockchainPart | undefined;

    if (domain[ProjectPropertyDomainEntity.getPrimaryKey()]) {
      blockchainPart = {
        id: domain.id as number,
        coopname: domain.coopname as string,
        username: domain.username as string,
        status: domain.status,
        project_hash: domain.project_hash as string,
        property_hash: domain.property_hash,
        property_amount: domain.property_amount as string,
        property_description: domain.property_description as string,
        created_at: new Date(domain.created_at ?? new Date()),
      };
    }

    return { ...dbPart, ...blockchainPart };
  }
}
