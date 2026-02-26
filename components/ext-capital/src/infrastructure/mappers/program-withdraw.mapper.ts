import { ProgramWithdrawDomainEntity } from '../../domain/entities/program-withdraw.entity';
import { ProgramWithdrawTypeormEntity } from '../entities/program-withdraw.typeorm-entity';
import type { IProgramWithdrawDatabaseData } from '../../domain/interfaces/program-withdraw-database.interface';
import type { IProgramWithdrawBlockchainData } from '../../domain/interfaces/program-withdraw-blockchain.interface';
import type { RequireFields } from '~/shared/utils/require-fields';
import type { ProgramWithdrawStatus } from '../../domain/enums/program-withdraw-status.enum';
import type { ISignedDocumentDomainInterface } from '~/domain/document/interfaces/signed-document-domain.interface';

type toEntityDatabasePart = RequireFields<Partial<ProgramWithdrawTypeormEntity>, keyof IProgramWithdrawDatabaseData>;
type toEntityBlockchainPart = RequireFields<Partial<ProgramWithdrawTypeormEntity>, keyof IProgramWithdrawBlockchainData>;

type toDomainDatabasePart = RequireFields<Partial<ProgramWithdrawDomainEntity>, keyof IProgramWithdrawDatabaseData>;
type toDomainBlockchainPart = RequireFields<Partial<ProgramWithdrawDomainEntity>, keyof IProgramWithdrawBlockchainData>;

/**
 * Маппер для преобразования между доменной сущностью возврата из программы и TypeORM сущностью
 */
export class ProgramWithdrawMapper {
  /**
   * Преобразование TypeORM сущности в доменную сущность
   */
  static toDomain(entity: ProgramWithdrawTypeormEntity): ProgramWithdrawDomainEntity {
    const databaseData: toDomainDatabasePart = {
      _id: entity._id,
      block_num: entity.block_num,
      present: entity.present,
      withdraw_hash: entity.withdraw_hash,
      blockchain_status: entity.blockchain_status,
      status: entity.status,
      _created_at: entity._created_at,
      _updated_at: entity._updated_at,
    };

    let blockchainData: toDomainBlockchainPart | undefined;

    if (entity[ProgramWithdrawDomainEntity.getPrimaryKey()]) {
      // Используем данные из TypeORM сущности
      blockchainData = {
        id: entity.id,
        coopname: entity.coopname,
        withdraw_hash: entity.withdraw_hash,
        username: entity.username,
        status: entity.blockchain_status as ProgramWithdrawStatus,
        amount: entity.amount,
        statement: entity.statement,
        created_at: entity.created_at.toISOString(),
      };
    }

    return new ProgramWithdrawDomainEntity(databaseData, blockchainData);
  }

  /**
   * Преобразование доменной сущности в TypeORM сущность для создания
   */
  static toEntity(domain: ProgramWithdrawDomainEntity): Partial<ProgramWithdrawTypeormEntity> {
    const dbPart: toEntityDatabasePart = {
      _id: domain._id,
      block_num: domain.block_num ?? 0,
      present: domain.present,
      withdraw_hash: domain.withdraw_hash,
      status: domain.status,
      blockchain_status: domain.blockchain_status as string,
      _created_at: domain._created_at as Date,
      _updated_at: domain._updated_at as Date,
    };

    let blockchainPart: toEntityBlockchainPart | undefined;

    if (domain[ProgramWithdrawDomainEntity.getPrimaryKey()]) {
      blockchainPart = {
        id: domain.id as number,
        coopname: domain.coopname as string,
        withdraw_hash: domain.withdraw_hash,
        username: domain.username as string,
        status: domain.status as ProgramWithdrawStatus,
        amount: domain.amount as string,
        statement: domain.statement as ISignedDocumentDomainInterface,
        created_at: new Date(domain.created_at ?? new Date()),
      };
    }

    return { ...dbPart, ...blockchainPart };
  }
}
