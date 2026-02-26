import { VoteDomainEntity } from '../../domain/entities/vote.entity';
import { VoteTypeormEntity } from '../entities/vote.typeorm-entity';
import type { IVoteDatabaseData } from '../../domain/interfaces/vote-database.interface';
import type { IVoteBlockchainData } from '../../domain/interfaces/vote-blockchain.interface';
import type { RequireFields } from '~/shared/utils/require-fields';

type toEntityDatabasePart = RequireFields<Partial<VoteTypeormEntity>, keyof IVoteDatabaseData>;
type toEntityBlockchainPart = RequireFields<Partial<VoteTypeormEntity>, keyof IVoteBlockchainData>;

type toDomainDatabasePart = RequireFields<Partial<VoteDomainEntity>, keyof IVoteDatabaseData>;
type toDomainBlockchainPart = RequireFields<Partial<VoteDomainEntity>, keyof IVoteBlockchainData>;

/**
 * Маппер для преобразования между доменной сущностью голоса и TypeORM сущностью
 */
export class VoteMapper {
  /**
   * Преобразование TypeORM сущности в доменную сущность
   */
  static toDomain(entity: VoteTypeormEntity): VoteDomainEntity {
    const databaseData: toDomainDatabasePart = {
      _id: entity._id,
      block_num: entity.block_num,
      present: entity.present,
      status: entity.status,
      _created_at: entity._created_at,
      _updated_at: entity._updated_at,
    };

    let blockchainData: toDomainBlockchainPart | undefined;

    if (entity[VoteDomainEntity.getPrimaryKey()]) {
      // Используем данные из TypeORM сущности
      blockchainData = {
        id: entity.id,
        coopname: entity.coopname,
        project_hash: entity.project_hash,
        voter: entity.voter,
        recipient: entity.recipient,
        amount: entity.amount,
        voted_at: entity.voted_at.toISOString(),
      };
    }

    return new VoteDomainEntity(databaseData, blockchainData, {
      voter_display_name: entity.voter_contributor?.display_name,
      recipient_display_name: entity.recipient_contributor?.display_name,
    });
  }

  /**
   * Преобразование доменной сущности в TypeORM сущность для создания
   */
  static toEntity(domain: VoteDomainEntity): Partial<VoteTypeormEntity> {
    const dbPart: toEntityDatabasePart = {
      _id: domain._id,
      block_num: domain.block_num ?? 0,
      present: domain.present,
      status: domain.status as string,
      _created_at: domain._created_at as Date,
      _updated_at: domain._updated_at as Date,
    };

    let blockchainPart: toEntityBlockchainPart | undefined;

    if (domain[VoteDomainEntity.getPrimaryKey()]) {
      blockchainPart = {
        id: domain.id as number,
        coopname: domain.coopname as string,
        project_hash: domain.project_hash as string,
        voter: domain.voter as string,
        recipient: domain.recipient as string,
        amount: domain.amount as string,
        voted_at: new Date(domain.voted_at ?? new Date()),
      };
    }

    return { ...dbPart, ...blockchainPart };
  }

  /**
   * Преобразование доменной сущности в данные для обновления TypeORM сущности
   * Обновляет только локальные поля базы данных, поля из блокчейна обновляются через синхронизацию
   */
  static toUpdateEntity(domain: Partial<VoteDomainEntity>): Partial<VoteTypeormEntity> {
    const updateData: Partial<VoteTypeormEntity> = {};

    // Поля из базы данных (локальные)
    if (domain.block_num !== undefined) updateData.block_num = domain.block_num;
    if (domain.present !== undefined) updateData.present = domain.present;

    // Примечание: Все поля из блокчейна (project_hash, voter, recipient, amount, voted_at)
    // обновляются автоматически через систему синхронизации с блокчейном (AbstractEntitySyncService)
    // и не должны обновляться вручную через этот метод

    return updateData;
  }
}
