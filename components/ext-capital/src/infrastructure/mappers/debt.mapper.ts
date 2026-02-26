import { DebtDomainEntity } from '../../domain/entities/debt.entity';
import { DebtTypeormEntity } from '../entities/debt.typeorm-entity';
import type { IDebtDatabaseData } from '../../domain/interfaces/debt-database.interface';
import type { IDebtBlockchainData } from '../../domain/interfaces/debt-blockchain.interface';
import type { RequireFields } from '~/shared/utils/require-fields';
import type { ISignedDocumentDomainInterface } from '~/domain/document/interfaces/signed-document-domain.interface';

type toEntityDatabasePart = RequireFields<Partial<DebtTypeormEntity>, keyof IDebtDatabaseData>;
type toEntityBlockchainPart = RequireFields<Partial<DebtTypeormEntity>, keyof IDebtBlockchainData>;

type toDomainDatabasePart = RequireFields<Partial<DebtDomainEntity>, keyof IDebtDatabaseData>;
type toDomainBlockchainPart = RequireFields<Partial<DebtDomainEntity>, keyof IDebtBlockchainData>;

/**
 * Маппер для преобразования между доменной сущностью долга и TypeORM сущностью
 */
export class DebtMapper {
  /**
   * Преобразование TypeORM сущности в доменную сущность
   */
  static toDomain(entity: DebtTypeormEntity): DebtDomainEntity {
    const databaseData: toDomainDatabasePart = {
      _id: entity._id,
      block_num: entity.block_num,
      present: entity.present,
      debt_hash: entity.debt_hash,
      status: entity.status,
      blockchain_status: entity.blockchain_status,
      _created_at: entity._created_at,
      _updated_at: entity._updated_at,
    };

    let blockchainData: toDomainBlockchainPart | undefined;

    if (entity[DebtDomainEntity.getPrimaryKey()]) {
      // Используем данные из TypeORM сущности
      blockchainData = {
        id: entity.id,
        coopname: entity.coopname,
        username: entity.username,
        debt_hash: entity.debt_hash,
        project_hash: entity.project_hash,
        status: entity.status,
        repaid_at: entity.repaid_at.toISOString(),
        amount: entity.amount,
        statement: entity.statement,
        approved_statement: entity.approved_statement,
        authorization: entity.authorization,
        memo: entity.memo,
      };
    }

    return new DebtDomainEntity(databaseData, blockchainData);
  }

  /**
   * Преобразование доменной сущности в TypeORM сущность для создания
   */
  static toEntity(domain: DebtDomainEntity): Partial<DebtTypeormEntity> {
    const dbPart: toEntityDatabasePart = {
      _id: domain._id,
      block_num: domain.block_num ?? 0,
      present: domain.present,
      debt_hash: domain.debt_hash,
      status: domain.status,
      blockchain_status: domain.blockchain_status as string,
      _created_at: domain._created_at as Date,
      _updated_at: domain._updated_at as Date,
    };

    let blockchainPart: toEntityBlockchainPart | undefined;

    if (domain[DebtDomainEntity.getPrimaryKey()]) {
      blockchainPart = {
        id: domain.id as number,
        coopname: domain.coopname as string,
        username: domain.username as string,
        debt_hash: domain.debt_hash,
        project_hash: domain.project_hash as string,
        status: domain.blockchain_status as any,
        repaid_at: domain.repaid_at ? new Date(domain.repaid_at) : new Date(),
        amount: domain.amount as string,
        statement: domain.statement as ISignedDocumentDomainInterface,
        approved_statement: domain.approved_statement as ISignedDocumentDomainInterface,
        authorization: domain.authorization as ISignedDocumentDomainInterface,
        memo: domain.memo as string,
      };
    }

    return { ...dbPart, ...blockchainPart };
  }

  /**
   * Преобразование доменной сущности в данные для обновления TypeORM сущности
   * Обновляет только локальные поля базы данных, поля из блокчейна обновляются через синхронизацию
   */
  static toUpdateEntity(domain: Partial<DebtDomainEntity>): Partial<DebtTypeormEntity> {
    const updateData: Partial<DebtTypeormEntity> = {};

    // Поля из базы данных (локальные)
    if (domain.block_num !== undefined) updateData.block_num = domain.block_num;
    if (domain.present !== undefined) updateData.present = domain.present;

    // Примечание: Все поля из блокчейна (coopname, debt_hash, status, amount, etc.)
    // обновляются автоматически через систему синхронизации с блокчейном (AbstractEntitySyncService)
    // и не должны обновляться вручную через этот метод

    return updateData;
  }
}
