import { ApprovalDomainEntity } from '../../domain/entities/approval.entity';
import { ApprovalTypeormEntity } from '../entities/approval-typeorm.entity';
import type { IApprovalDatabaseData } from '../../domain/interfaces/approval-database.interface';
import type { IApprovalBlockchainData } from '../../domain/interfaces/approval-blockchain.interface';
import type { RequireFields } from '~/shared/utils/require-fields';
import type { ISignedDocumentDomainInterface } from '@coopenomics/innercoop';

type toEntityDatabasePart = RequireFields<Partial<ApprovalTypeormEntity>, keyof IApprovalDatabaseData>;
type toEntityBlockchainPart = RequireFields<Partial<ApprovalTypeormEntity>, keyof IApprovalBlockchainData>;

type toDomainDatabasePart = RequireFields<Partial<ApprovalDomainEntity>, keyof IApprovalDatabaseData>;

/**
 * Маппер для преобразования между доменной сущностью одобрения и TypeORM сущностью
 */
export class ApprovalMapper {
  /**
   * Преобразование TypeORM сущности в доменную сущность
   */
  static toDomain(entity: ApprovalTypeormEntity): ApprovalDomainEntity {
    const databaseData: toDomainDatabasePart = {
      _id: entity._id,
      block_num: entity.block_num,
      present: entity.present,
      status: entity.status,
      _created_at: entity._created_at,
      _updated_at: entity._updated_at,
      approval_hash: entity.approval_hash,
      approved_document: entity.approved_document as ISignedDocumentDomainInterface,
    };

    let blockchainData: IApprovalBlockchainData | undefined;

    if (entity[ApprovalDomainEntity.getPrimaryKey()] !== undefined) {
      // Используем данные из TypeORM сущности
      blockchainData = {
        id: entity.id,
        coopname: entity.coopname,
        username: entity.username,
        document: entity.document,
        approval_hash: entity.approval_hash,
        callback_contract: entity.callback_contract,
        callback_action_approve: entity.callback_action_approve,
        callback_action_decline: entity.callback_action_decline,
        meta: entity.meta,
        created_at: entity.created_at.toISOString(),
      } as IApprovalBlockchainData;
    }

    return new ApprovalDomainEntity(databaseData, blockchainData);
  }

  /**
   * Преобразование доменной сущности в TypeORM сущность для создания
   */
  static toEntity(domain: ApprovalDomainEntity): Partial<ApprovalTypeormEntity> {
    const dbPart: toEntityDatabasePart = {
      _id: domain._id,
      block_num: domain.block_num ?? 0,
      present: domain.present,
      status: domain.status,
      _created_at: domain._created_at,
      _updated_at: domain._updated_at,
      approval_hash: domain.approval_hash,
      approved_document: domain.approved_document as ISignedDocumentDomainInterface,
    };

    let blockchainPart: toEntityBlockchainPart | undefined;

    if (domain[ApprovalDomainEntity.getPrimaryKey()] !== undefined) {
      blockchainPart = {
        id: domain.id as number,
        coopname: domain.coopname as string,
        username: domain.username as string,
        document: domain.document,
        approval_hash: domain.approval_hash,
        callback_contract: domain.callback_contract,
        callback_action_approve: domain.callback_action_approve,
        callback_action_decline: domain.callback_action_decline,
        meta: domain.meta,
        created_at: domain.created_at,
      };
    }

    return { ...dbPart, ...blockchainPart };
  }
}
