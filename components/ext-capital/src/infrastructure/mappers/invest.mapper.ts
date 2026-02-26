import { InvestDomainEntity } from '../../domain/entities/invest.entity';
import { InvestTypeormEntity } from '../entities/invest.typeorm-entity';
import type { IInvestDatabaseData } from '../../domain/interfaces/invest-database.interface';
import type { IInvestBlockchainData } from '../../domain/interfaces/invest-blockchain.interface';
import type { RequireFields } from '~/shared/utils/require-fields';
import type { ISignedDocumentDomainInterface } from '~/domain/document/interfaces/signed-document-domain.interface';

type toEntityDatabasePart = RequireFields<Partial<InvestTypeormEntity>, keyof IInvestDatabaseData>;
type toEntityBlockchainPart = RequireFields<Partial<InvestTypeormEntity>, keyof IInvestBlockchainData>;

type toDomainDatabasePart = RequireFields<Partial<InvestDomainEntity>, keyof IInvestDatabaseData>;
type toDomainBlockchainPart = RequireFields<Partial<InvestDomainEntity>, keyof IInvestBlockchainData>;

/**
 * Маппер для преобразования между доменной сущностью инвестиции и TypeORM сущностью
 */
export class InvestMapper {
  /**
   * Преобразование TypeORM сущности в доменную сущность
   */
  static toDomain(entity: InvestTypeormEntity): InvestDomainEntity {
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

    if (entity[InvestDomainEntity.getPrimaryKey()]) {
      // Используем данные из TypeORM сущности
      blockchainData = {
        id: entity.id,
        coopname: entity.coopname,
        username: entity.username,
        invest_hash: entity.invest_hash,
        project_hash: entity.project_hash,
        status: entity.status,
        amount: entity.amount,
        invested_at: entity.invested_at.toISOString(),
        statement: entity.statement,
        coordinator: entity.coordinator,
        coordinator_amount: entity.coordinator_amount,
      };
    }

    return new InvestDomainEntity(databaseData, blockchainData);
  }

  /**
   * Преобразование доменной сущности в TypeORM сущность для создания
   */
  static toEntity(domain: InvestDomainEntity): Partial<InvestTypeormEntity> {
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

    if (domain[InvestDomainEntity.getPrimaryKey()]) {
      blockchainPart = {
        id: domain.id as number,
        coopname: domain.coopname as string,
        username: domain.username as string,
        invest_hash: domain.invest_hash,
        project_hash: domain.project_hash as string,
        status: domain.blockchain_status as any,
        amount: domain.amount as string,
        invested_at: new Date(domain.invested_at ?? new Date()),
        statement: domain.statement as ISignedDocumentDomainInterface,
        coordinator: domain.coordinator as string,
        coordinator_amount: domain.coordinator_amount as string,
      };
    }

    return { ...dbPart, ...blockchainPart };
  }

  /**
   * Преобразование доменной сущности в данные для обновления TypeORM сущности
   * Обновляет только локальные поля базы данных, поля из блокчейна обновляются через синхронизацию
   */
  static toUpdateEntity(domain: Partial<InvestDomainEntity>): Partial<InvestTypeormEntity> {
    const updateData: Partial<InvestTypeormEntity> = {};

    // Поля из базы данных (локальные)
    if (domain._id !== undefined) updateData._id = domain._id;
    if (domain.id !== undefined) updateData.id = domain.id;
    if (domain.block_num !== undefined) updateData.block_num = domain.block_num;
    if (domain.present !== undefined) updateData.present = domain.present;

    // Примечание: Все поля из блокчейна (coopname, invest_hash, status, amount, invested_at, statement, coordinator, coordinator_amount)
    // обновляются автоматически через систему синхронизации с блокчейном (AbstractEntitySyncService)
    // и не должны обновляться вручную через этот метод

    return updateData;
  }
}
