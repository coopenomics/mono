import { ProgramInvestDomainEntity } from '../../domain/entities/program-invest.entity';
import { ProgramInvestTypeormEntity } from '../entities/program-invest.typeorm-entity';
import type { IProgramInvestDatabaseData } from '../../domain/interfaces/program-invest-database.interface';
import type { IProgramInvestBlockchainData } from '../../domain/interfaces/program-invest-blockchain.interface';
import type { RequireFields } from '~/shared/utils/require-fields';
import type { ISignedDocumentDomainInterface } from '~/domain/document/interfaces/signed-document-domain.interface';

type toEntityDatabasePart = RequireFields<Partial<ProgramInvestTypeormEntity>, keyof IProgramInvestDatabaseData>;
type toEntityBlockchainPart = RequireFields<Partial<ProgramInvestTypeormEntity>, keyof IProgramInvestBlockchainData>;

type toDomainDatabasePart = RequireFields<Partial<ProgramInvestDomainEntity>, keyof IProgramInvestDatabaseData>;
type toDomainBlockchainPart = RequireFields<Partial<ProgramInvestDomainEntity>, keyof IProgramInvestBlockchainData>;

/**
 * Маппер для преобразования между доменной сущностью программной инвестиции и TypeORM сущностью
 */
export class ProgramInvestMapper {
  /**
   * Преобразование TypeORM сущности в доменную сущность
   */
  static toDomain(entity: ProgramInvestTypeormEntity): ProgramInvestDomainEntity {
    const databaseData: toDomainDatabasePart = {
      _id: entity._id,
      block_num: entity.block_num,
      present: entity.present,
      invest_hash: entity.invest_hash,
      status: entity.status,
      blockchain_status: entity.blockchain_status,
      _created_at: entity._created_at,
      _updated_at: entity._updated_at,
    };

    let blockchainData: toDomainBlockchainPart | undefined;

    if (entity[ProgramInvestDomainEntity.getPrimaryKey()]) {
      // Используем данные из TypeORM сущности
      blockchainData = {
        id: entity.id,
        coopname: entity.coopname,
        username: entity.username,
        invest_hash: entity.invest_hash,
        status: entity.blockchain_status as any,
        invested_at: entity.invested_at.toISOString(),
        statement: entity.statement,
        amount: entity.amount,
      };
    }

    return new ProgramInvestDomainEntity(databaseData, blockchainData);
  }

  /**
   * Преобразование доменной сущности в TypeORM сущность для создания
   */
  static toEntity(domain: ProgramInvestDomainEntity): Partial<ProgramInvestTypeormEntity> {
    const dbPart: toEntityDatabasePart = {
      _id: domain._id,
      block_num: domain.block_num ?? 0,
      present: domain.present,
      invest_hash: domain.invest_hash,
      status: domain.status,
      blockchain_status: domain.blockchain_status as string,
      _created_at: domain._created_at as Date,
      _updated_at: domain._updated_at as Date,
    };

    let blockchainPart: toEntityBlockchainPart | undefined;

    if (domain[ProgramInvestDomainEntity.getPrimaryKey()]) {
      blockchainPart = {
        id: domain.id as number,
        coopname: domain.coopname as string,
        username: domain.username as string,
        invest_hash: domain.invest_hash,
        status: domain.blockchain_status as any,
        invested_at: new Date(domain.invested_at ?? new Date()),
        statement: domain.statement as ISignedDocumentDomainInterface,
        amount: domain.amount as string,
      };
    }

    return { ...dbPart, ...blockchainPart };
  }
}
