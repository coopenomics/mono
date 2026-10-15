import { pickDefined } from '@coopenomics/extension-kit';
import { AgreementDomainEntity } from '~/domain/agreement/entities/agreement.entity';
import { AgreementRecord } from '../records/agreement.record';
import type { IAgreementDatabaseData } from '~/domain/agreement/interfaces/agreement-database.interface';
import type { IAgreementBlockchainData } from '~/domain/agreement/interfaces/agreement-blockchain.interface';

/**
 * Маппер для преобразования между доменной сущностью соглашения и TypeORM сущностью
 */
export class AgreementMapper {
  /**
   * Преобразование TypeORM сущности в доменную сущность
   */
  static toDomain(entity: AgreementRecord): AgreementDomainEntity {
    const databaseData: IAgreementDatabaseData = {
      _id: entity._id,
      block_num: entity.block_num,
      present: entity.present,
      status: entity.status,
      _created_at: entity._created_at,
      _updated_at: entity._updated_at,
    };

    // Используем данные из TypeORM сущности для блокчейн данных
    const blockchainData: IAgreementBlockchainData = {
      id: entity.id || 0,
      coopname: entity.coopname,
      username: entity.username,
      type: entity.type,
      program_id: entity.program_id,
      draft_id: entity.draft_id,
      version: entity.version,
      document: entity.document,
      status: entity.blockchain_status as any, // Приведение типа статуса
      updated_at: entity.updated_at.toISOString(),
    };

    return new AgreementDomainEntity(databaseData, blockchainData);
  }

  /**
   * Преобразование доменной сущности в TypeORM сущность для создания
   */
  static toEntity(domain: Partial<AgreementDomainEntity>): Partial<AgreementRecord> {
    const entity: Partial<AgreementRecord> = {
      _id: domain._id,
      block_num: domain.block_num,
      present: domain.present,
      status: domain.status,
      _created_at: domain._created_at,
      _updated_at: domain._updated_at,
    };

    // Поля из блокчейна: переносятся только заданные.
    Object.assign(entity, pickDefined(domain, ['id', 'coopname', 'username', 'type', 'document']));
    for (const field of ['program_id', 'draft_id', 'version'] as const) {
      if (domain[field] !== undefined) entity[field] = Number(domain[field]);
    }
    if (domain.blockchain_status !== undefined) entity.blockchain_status = domain.blockchain_status.toString();
    if (domain.updated_at !== undefined) entity.updated_at = new Date(domain.updated_at);

    return entity;
  }
}
