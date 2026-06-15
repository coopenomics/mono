import { ExpenseProposalDomainEntity } from '../../domain/entities/expense-proposal.entity';
import { ExpenseProposalTypeormEntity } from '../entities/expense-proposal.typeorm-entity';
import type { IExpenseProposalDatabaseData } from '../../domain/interfaces/expense-proposal-database.interface';
import type { IExpenseProposalBlockchainData } from '../../domain/interfaces/expense-proposal-blockchain.interface';
import { ExpenseProposalStatus } from '../../domain/enums/expense-proposal-status.enum';

/**
 * Маппер `ExpenseProposalTypeormEntity` ↔ `ExpenseProposalDomainEntity`.
 *
 * Логика идентична capital-стилю: статус/идентификация хранится локально,
 * экономика (items, total_*, документы) — образ блокчейна и обновляется
 * только через `AbstractEntitySyncService`. Поэтому `toUpdateEntity`
 * пробрасывает наверх только `block_num`/`present`.
 */
export class ExpenseProposalMapper {
  static toDomain(entity: ExpenseProposalTypeormEntity): ExpenseProposalDomainEntity {
    const databaseData: IExpenseProposalDatabaseData = {
      _id: entity._id,
      block_num: entity.block_num,
      present: entity.present,
      proposal_hash: entity.proposal_hash,
      coopname: entity.coopname,
      status: entity.status ?? ExpenseProposalStatus.UNDEFINED,
      _created_at: entity._created_at,
      _updated_at: entity._updated_at,
    };

    let blockchainData: IExpenseProposalBlockchainData | undefined;

    if (entity.id) {
      blockchainData = {
        id: String(entity.id),
        proposal_hash: entity.proposal_hash,
        coopname: entity.coopname,
        username: entity.username,
        source_wallet: entity.source_wallet,
        status: entity.blockchain_status,
        items: entity.items ?? [],
        total_planned: entity.total_planned,
        total_actual: entity.total_actual,
        callback: entity.callback ?? undefined,
        statement_doc: entity.statement_doc ?? undefined,
        decision_doc: entity.decision_doc ?? undefined,
        created_at: entity.created_at?.toISOString?.() ?? '',
        updated_at: entity.updated_at?.toISOString?.() ?? '',
      };
    }

    return new ExpenseProposalDomainEntity(databaseData, blockchainData);
  }

  static toEntity(domain: ExpenseProposalDomainEntity): Partial<ExpenseProposalTypeormEntity> {
    const dbPart: Partial<ExpenseProposalTypeormEntity> = {
      _id: domain._id,
      block_num: domain.block_num ?? 0,
      present: domain.present,
      proposal_hash: domain.proposal_hash,
      coopname: domain.coopname,
      status: domain.status,
      _created_at: domain._created_at as Date,
      _updated_at: domain._updated_at as Date,
    };

    if (domain.id !== undefined) {
      const bcPart: Partial<ExpenseProposalTypeormEntity> = {
        id: domain.id,
        username: domain.username,
        source_wallet: domain.source_wallet,
        blockchain_status: domain.blockchain_status,
        items: domain.items ?? [],
        total_planned: domain.total_planned,
        total_actual: domain.total_actual,
        callback: domain.callback ?? null,
        statement_doc: domain.statement_doc ?? null,
        decision_doc: domain.decision_doc ?? null,
        created_at: domain.created_at ? new Date(domain.created_at) : new Date(),
        updated_at: domain.updated_at ? new Date(domain.updated_at) : new Date(),
      };
      Object.assign(dbPart, bcPart);
    }

    return dbPart;
  }

  static toUpdateEntity(domain: Partial<ExpenseProposalDomainEntity>): Partial<ExpenseProposalTypeormEntity> {
    const updateData: Partial<ExpenseProposalTypeormEntity> = {};
    if (domain.block_num !== undefined) updateData.block_num = domain.block_num;
    if (domain.present !== undefined) updateData.present = domain.present;
    return updateData;
  }
}
