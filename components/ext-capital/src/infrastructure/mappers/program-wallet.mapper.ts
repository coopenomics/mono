import { ProgramWalletDomainEntity } from '../../domain/entities/program-wallet.entity';
import { ProgramWalletTypeormEntity } from '../entities/program-wallet.typeorm-entity';
import type { IProgramWalletDatabaseData } from '../../domain/interfaces/program-wallet-database.interface';
import type { IProgramWalletBlockchainData } from '../../domain/interfaces/program-wallet-blockchain.interface';
import type { RequireFields } from '~/shared/utils/require-fields';

type toEntityDatabasePart = RequireFields<Partial<ProgramWalletTypeormEntity>, keyof IProgramWalletDatabaseData>;
type toEntityBlockchainPart = RequireFields<Partial<ProgramWalletTypeormEntity>, keyof IProgramWalletBlockchainData>;

type toDomainDatabasePart = RequireFields<Partial<ProgramWalletDomainEntity>, keyof IProgramWalletDatabaseData>;
type toDomainBlockchainPart = RequireFields<Partial<ProgramWalletDomainEntity>, keyof IProgramWalletBlockchainData>;

/**
 * Маппер для преобразования между доменной сущностью программного кошелька и TypeORM сущностью
 */
export class ProgramWalletMapper {
  /**
   * Преобразование TypeORM сущности в доменную сущность
   */
  static toDomain(entity: ProgramWalletTypeormEntity): ProgramWalletDomainEntity {
    const databaseData: toDomainDatabasePart = {
      _id: entity._id,
      block_num: entity.block_num,
      present: entity.present,
      status: entity.status,
      username: entity.username,
      _created_at: entity._created_at,
      _updated_at: entity._updated_at,
    };

    let blockchainData: toDomainBlockchainPart | undefined;

    if (entity[ProgramWalletDomainEntity.getPrimaryKey()]) {
      // Используем данные из TypeORM сущности
      blockchainData = {
        id: entity.id,
        coopname: entity.coopname,
        username: entity.username,
        last_program_crps: entity.last_program_crps,
        capital_available: entity.capital_available,
      };
    }

    return new ProgramWalletDomainEntity(databaseData, blockchainData);
  }

  /**
   * Преобразование доменной сущности в TypeORM сущность для создания
   */
  static toEntity(domain: ProgramWalletDomainEntity): Partial<ProgramWalletTypeormEntity> {
    const dbPart: toEntityDatabasePart = {
      _id: domain._id,
      block_num: domain.block_num ?? 0,
      present: domain.present,
      status: domain.status as string,
      username: domain.username,
      _created_at: domain._created_at as Date,
      _updated_at: domain._updated_at as Date,
    };

    let blockchainPart: toEntityBlockchainPart | undefined;

    if (domain[ProgramWalletDomainEntity.getPrimaryKey()]) {
      blockchainPart = {
        id: domain.id as number,
        coopname: domain.coopname as string,
        username: domain.username,
        last_program_crps: domain.last_program_crps as number,
        capital_available: domain.capital_available as string,
      };
    }

    return { ...dbPart, ...blockchainPart };
  }
}
