import { ProgramExpenseDomainEntity } from '../../domain/entities/program-expense.entity';
import { ProgramExpenseTypeormEntity } from '../entities/program-expense.typeorm-entity';
import type { IProgramExpenseDatabaseData } from '../../domain/interfaces/program-expense-database.interface';
import type { IProgramExpenseBlockchainData } from '../../domain/interfaces/program-expense-blockchain.interface';
import type { RequireFields } from '~/shared/utils/require-fields';
import type { ISignedDocumentDomainInterface } from '~/domain/document/interfaces/signed-document-domain.interface';

type toEntityDatabasePart = RequireFields<Partial<ProgramExpenseTypeormEntity>, keyof IProgramExpenseDatabaseData>;
type toEntityBlockchainPart = RequireFields<Partial<ProgramExpenseTypeormEntity>, keyof IProgramExpenseBlockchainData>;

type toDomainDatabasePart = RequireFields<Partial<ProgramExpenseDomainEntity>, keyof IProgramExpenseDatabaseData>;
type toDomainBlockchainPart = RequireFields<Partial<ProgramExpenseDomainEntity>, keyof IProgramExpenseBlockchainData>;

export class ProgramExpenseMapper {
  static toDomain(entity: ProgramExpenseTypeormEntity): ProgramExpenseDomainEntity {
    const databaseData: toDomainDatabasePart = {
      _id: entity._id,
      block_num: entity.block_num,
      present: entity.present,
      expense_hash: entity.expense_hash,
      status: entity.status,
      blockchain_status: entity.blockchain_status,
      _created_at: entity._created_at,
      _updated_at: entity._updated_at,
    };

    let blockchainData: toDomainBlockchainPart | undefined;

    if (entity[ProgramExpenseDomainEntity.getPrimaryKey()]) {
      blockchainData = {
        id: entity.id,
        coopname: entity.coopname,
        username: entity.username,
        expense_hash: entity.expense_hash,
        fund_id: entity.fund_id,
        status: entity.status,
        amount: entity.amount,
        description: entity.description,
        expense_statement: entity.expense_statement,
        approved_statement: entity.approved_statement,
        authorization: entity.authorization,
        spended_at: entity.spended_at.toISOString(),
      };
    }

    return new ProgramExpenseDomainEntity(databaseData, blockchainData);
  }

  static toEntity(domain: ProgramExpenseDomainEntity): Partial<ProgramExpenseTypeormEntity> {
    const dbPart: toEntityDatabasePart = {
      _id: domain._id,
      block_num: domain.block_num ?? 0,
      present: domain.present,
      expense_hash: domain.expense_hash,
      status: domain.status,
      blockchain_status: domain.blockchain_status as string,
      _created_at: domain._created_at as Date,
      _updated_at: domain._updated_at as Date,
    };

    let blockchainPart: toEntityBlockchainPart | undefined;

    if (domain[ProgramExpenseDomainEntity.getPrimaryKey()]) {
      blockchainPart = {
        id: domain.id as number,
        coopname: domain.coopname as string,
        username: domain.username as string,
        expense_hash: domain.expense_hash,
        fund_id: domain.fund_id as string,
        status: domain.blockchain_status as any,
        amount: domain.amount as string,
        description: domain.description as string,
        expense_statement: domain.expense_statement as ISignedDocumentDomainInterface,
        approved_statement: domain.approved_statement as ISignedDocumentDomainInterface,
        authorization: domain.authorization as ISignedDocumentDomainInterface,
        spended_at: new Date(domain.spended_at ?? new Date()),
      };
    }

    return { ...dbPart, ...blockchainPart };
  }

  static toUpdateEntity(domain: Partial<ProgramExpenseDomainEntity>): Partial<ProgramExpenseTypeormEntity> {
    const updateData: Partial<ProgramExpenseTypeormEntity> = {};

    if (domain.block_num !== undefined) updateData.block_num = domain.block_num;
    if (domain.present !== undefined) updateData.present = domain.present;

    return updateData;
  }
}
