import { ProgramPropertyDomainEntity } from '../../domain/entities/program-property.entity';
import { ProgramPropertyTypeormEntity } from '../entities/program-property.typeorm-entity';
import type { IProgramPropertyDatabaseData } from '../../domain/interfaces/program-property-database.interface';
import type { IProgramPropertyBlockchainData } from '../../domain/interfaces/program-property-blockchain.interface';
import type { RequireFields } from '~/shared/utils/require-fields';
import type { ISignedDocumentDomainInterface } from '~/domain/document/interfaces/signed-document-domain.interface';
import type { ProgramPropertyStatus } from '../../domain/enums/program-property-status.enum';

type toEntityDatabasePart = RequireFields<Partial<ProgramPropertyTypeormEntity>, keyof IProgramPropertyDatabaseData>;
type toEntityBlockchainPart = RequireFields<Partial<ProgramPropertyTypeormEntity>, keyof IProgramPropertyBlockchainData>;

type toDomainDatabasePart = RequireFields<Partial<ProgramPropertyDomainEntity>, keyof IProgramPropertyDatabaseData>;
type toDomainBlockchainPart = RequireFields<Partial<ProgramPropertyDomainEntity>, keyof IProgramPropertyBlockchainData>;

/**
 * Маппер для преобразования между доменной сущностью программного имущественного взноса и TypeORM сущностью
 */
export class ProgramPropertyMapper {
  /**
   * Преобразование TypeORM сущности в доменную сущность
   */
  static toDomain(entity: ProgramPropertyTypeormEntity): ProgramPropertyDomainEntity {
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

    if (entity[ProgramPropertyDomainEntity.getPrimaryKey()]) {
      // Используем данные из TypeORM сущности
      blockchainData = {
        id: entity.id,
        coopname: entity.coopname,
        username: entity.username,
        status: entity.status,
        property_hash: entity.property_hash,
        property_amount: entity.property_amount,
        property_description: entity.property_description,
        statement: entity.statement,
        authorization: entity.authorization,
        act: entity.act,
        created_at: entity.created_at.toISOString(),
      };
    }

    return new ProgramPropertyDomainEntity(databaseData, blockchainData);
  }

  /**
   * Преобразование доменной сущности в TypeORM сущность для создания
   */
  static toEntity(domain: ProgramPropertyDomainEntity): Partial<ProgramPropertyTypeormEntity> {
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

    if (domain[ProgramPropertyDomainEntity.getPrimaryKey()]) {
      blockchainPart = {
        id: domain.id as number,
        coopname: domain.coopname as string,
        username: domain.username as string,
        status: domain.status as ProgramPropertyStatus,
        property_hash: domain.property_hash,
        property_amount: domain.property_amount as string,
        property_description: domain.property_description as string,
        statement: domain.statement as ISignedDocumentDomainInterface,
        authorization: domain.authorization as ISignedDocumentDomainInterface,
        act: domain.act as ISignedDocumentDomainInterface,
        created_at: new Date(domain.created_at ?? new Date()),
      };
    }

    return { ...dbPart, ...blockchainPart };
  }
}
