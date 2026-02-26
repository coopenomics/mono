import { CommitDomainEntity, type CommitData } from '../../domain/entities/commit.entity';
import { CommitTypeormEntity } from '../entities/commit.typeorm-entity';
import type { ICommitDatabaseData } from '../../domain/interfaces/commit-database.interface';
import type { ICommitBlockchainData } from '../../domain/interfaces/commit-blockchain.interface';
import type { RequireFields } from '~/shared/utils/require-fields';

type toEntityDatabasePart = RequireFields<Partial<CommitTypeormEntity>, keyof ICommitDatabaseData>;
type toEntityBlockchainPart = RequireFields<Partial<CommitTypeormEntity>, keyof ICommitBlockchainData>;

type toDomainDatabasePart = RequireFields<Partial<CommitDomainEntity>, keyof ICommitDatabaseData>;
type toDomainBlockchainPart = RequireFields<Partial<CommitDomainEntity>, keyof ICommitBlockchainData>;

/**
 * Маппер для преобразования между доменной сущностью коммита и TypeORM сущностью
 */
export class CommitMapper {
  /**
   * Преобразование TypeORM сущности в доменную сущность
   */
  static toDomain(entity: CommitTypeormEntity): CommitDomainEntity {
    const databaseData: toDomainDatabasePart = {
      _id: entity._id,
      block_num: entity.block_num,
      present: entity.present,
      commit_hash: entity.commit_hash,
      status: entity.status,
      blockchain_status: entity.blockchain_status,
      data: entity.data,
      _created_at: entity._created_at,
      _updated_at: entity._updated_at,
    };

    let blockchainData: toDomainBlockchainPart | undefined;

    if (entity[CommitDomainEntity.getPrimaryKey()]) {
      // Используем данные из TypeORM сущности
      blockchainData = {
        id: entity.id,
        coopname: entity.coopname,
        username: entity.username,
        project_hash: entity.project_hash,
        commit_hash: entity.commit_hash,
        amounts: entity.amounts,
        description: entity.description,
        meta: entity.meta,
        status: entity.status,
        created_at: entity.created_at.toISOString(),
      };
    }

    return new CommitDomainEntity(databaseData, blockchainData, {
      display_name: entity.contributor?.display_name,
    });
  }

  /**
   * Преобразование доменной сущности в TypeORM сущность для создания
   */
  static toEntity(domain: CommitDomainEntity): Partial<CommitTypeormEntity> {
    const dbPart: toEntityDatabasePart = {
      _id: domain._id,
      block_num: domain.block_num ?? 0,
      present: domain.present,
      commit_hash: domain.commit_hash,
      status: domain.status,
      blockchain_status: domain.blockchain_status as string,
      data: domain.data as CommitData,
      _created_at: domain._created_at as Date,
      _updated_at: domain._updated_at as Date,
    };

    let blockchainPart: toEntityBlockchainPart | undefined;

    if (domain[CommitDomainEntity.getPrimaryKey()]) {
      blockchainPart = {
        id: domain.id as number,
        coopname: domain.coopname as string,
        username: domain.username as string,
        project_hash: domain.project_hash as string,
        commit_hash: domain.commit_hash,
        amounts: domain.amounts as any,
        description: domain.description as string,
        meta: domain.meta as string,
        status: domain.status as any,
        created_at: new Date(domain.created_at ?? new Date()),
      };
    }

    return { ...dbPart, ...blockchainPart };
  }

  /**
   * Преобразование доменной сущности в данные для обновления TypeORM сущности
   * Обновляет только локальные поля базы данных, поля из блокчейна обновляются через синхронизацию
   */
  static toUpdateEntity(domain: Partial<CommitDomainEntity>): Partial<CommitTypeormEntity> {
    const updateData: Partial<CommitTypeormEntity> = {};

    // Поля из базы данных (локальные)
    if (domain.block_num !== undefined) updateData.block_num = domain.block_num;
    if (domain.present !== undefined) updateData.present = domain.present;

    // Примечание: Все поля из блокчейна (coopname, commit_hash, status, amounts, etc.)
    // обновляются автоматически через систему синхронизации с блокчейном (AbstractEntitySyncService)
    // и не должны обновляться вручную через этот метод

    return updateData;
  }
}
