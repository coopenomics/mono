import { StateDomainEntity } from '../../domain/entities/state.entity';
import { StateTypeormEntity } from '../entities/state.typeorm-entity';
import type { IStateDatabaseData } from '../../domain/interfaces/state-database.interface';
import type { IStateBlockchainData } from '../../domain/interfaces/state-blockchain.interface';
import type { RequireFields } from '~/shared/utils/require-fields';

type toEntityDatabasePart = RequireFields<Partial<StateTypeormEntity>, keyof IStateDatabaseData>;
type toEntityBlockchainPart = RequireFields<Partial<StateTypeormEntity>, keyof IStateBlockchainData>;

type toDomainDatabasePart = RequireFields<Partial<StateDomainEntity>, keyof IStateDatabaseData>;
type toDomainBlockchainPart = RequireFields<Partial<StateDomainEntity>, keyof IStateBlockchainData>;

/**
 * Маппер для преобразования между доменной сущностью состояния и TypeORM сущностью
 */
export class StateMapper {
  /**
   * Преобразование TypeORM сущности в доменную сущность
   */
  static toDomain(entity: StateTypeormEntity): StateDomainEntity {
    const databaseData: toDomainDatabasePart = {
      _id: entity._id,
      block_num: entity.block_num,
      present: entity.present,
      coopname: entity.coopname,
      _created_at: entity._created_at,
      _updated_at: entity._updated_at,
      status: entity.status,
    };

    let blockchainData: toDomainBlockchainPart | undefined;

    if (entity[StateDomainEntity.getPrimaryKey()]) {
      // Используем данные из TypeORM сущности
      blockchainData = {
        coopname: entity.coopname,
        global_available_invest_pool: entity.global_available_invest_pool,
        program_membership_funded: entity.program_membership_funded,
        program_membership_available: entity.program_membership_available,
        program_membership_distributed: entity.program_membership_distributed,
        program_membership_cumulative_reward_per_share: entity.program_membership_cumulative_reward_per_share,
        config: entity.config,
      };
    }

    return new StateDomainEntity(databaseData, blockchainData);
  }

  /**
   * Преобразование доменной сущности в TypeORM сущность для создания
   */
  static toEntity(domain: StateDomainEntity): Partial<StateTypeormEntity> {
    const dbPart: toEntityDatabasePart = {
      _id: domain._id,
      block_num: domain.block_num ?? 0,
      present: domain.present,
      coopname: domain.coopname,
      status: domain.status as string,
      _created_at: domain._created_at as Date,
      _updated_at: domain._updated_at as Date,
    };

    let blockchainPart: toEntityBlockchainPart | undefined;

    if (domain[StateDomainEntity.getPrimaryKey()]) {
      blockchainPart = {
        coopname: domain.coopname,
        global_available_invest_pool: domain.global_available_invest_pool as string,
        program_membership_funded: domain.program_membership_funded as string,
        program_membership_available: domain.program_membership_available as string,
        program_membership_distributed: domain.program_membership_distributed as string,
        program_membership_cumulative_reward_per_share: domain.program_membership_cumulative_reward_per_share as number,
        config: domain.config as toEntityBlockchainPart['config'],
      };
    }

    return { ...dbPart, ...blockchainPart };
  }

  /**
   * Преобразование доменной сущности в данные для обновления TypeORM сущности
   * Обновляет только локальные поля базы данных, поля из блокчейна обновляются через синхронизацию
   */
  static toUpdateEntity(domain: Partial<StateDomainEntity>): Partial<StateTypeormEntity> {
    const updateData: Partial<StateTypeormEntity> = {};

    // Поля из базы данных (локальные)
    if (domain.block_num !== undefined) updateData.block_num = domain.block_num;
    if (domain.present !== undefined) updateData.present = domain.present;

    // Примечание: Все поля из блокчейна (coopname, global_available_invest_pool, program_membership_funded, etc.)
    // обновляются автоматически через систему синхронизации с блокчейном (AbstractEntitySyncService)
    // и не должны обновляться вручную через этот метод

    return updateData;
  }
}
