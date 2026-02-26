import { ExpenseDomainEntity } from '../../domain/entities/expense.entity';
import { ExpenseTypeormEntity } from '../entities/expense.typeorm-entity';
import type { IExpenseDatabaseData } from '../../domain/interfaces/expense-database.interface';
import type { IExpenseBlockchainData } from '../../domain/interfaces/expense-blockchain.interface';
import type { RequireFields } from '~/shared/utils/require-fields';
import type { ISignedDocumentDomainInterface } from '~/domain/document/interfaces/signed-document-domain.interface';

type toEntityDatabasePart = RequireFields<Partial<ExpenseTypeormEntity>, keyof IExpenseDatabaseData>;
type toEntityBlockchainPart = RequireFields<Partial<ExpenseTypeormEntity>, keyof IExpenseBlockchainData>;

type toDomainDatabasePart = RequireFields<Partial<ExpenseDomainEntity>, keyof IExpenseDatabaseData>;
type toDomainBlockchainPart = RequireFields<Partial<ExpenseDomainEntity>, keyof IExpenseBlockchainData>;

/**
 * Маппер для преобразования между доменной сущностью расхода и TypeORM сущностью
 */
export class ExpenseMapper {
  /**
   * Преобразование TypeORM сущности в доменную сущность
   */
  static toDomain(entity: ExpenseTypeormEntity): ExpenseDomainEntity {
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

    if (entity[ExpenseDomainEntity.getPrimaryKey()]) {
      // Используем данные из TypeORM сущности
      blockchainData = {
        id: entity.id,
        coopname: entity.coopname,
        username: entity.username,
        project_hash: entity.project_hash,
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

    return new ExpenseDomainEntity(databaseData, blockchainData);
  }

  /**
   * Преобразование доменной сущности в TypeORM сущность для создания
   */
  static toEntity(domain: ExpenseDomainEntity): Partial<ExpenseTypeormEntity> {
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

    if (domain[ExpenseDomainEntity.getPrimaryKey()]) {
      blockchainPart = {
        id: domain.id as number,
        coopname: domain.coopname as string,
        username: domain.username as string,
        project_hash: domain.project_hash as string,
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

  /**
   * Преобразование доменной сущности в данные для обновления TypeORM сущности
   * Обновляет только локальные поля базы данных, поля из блокчейна обновляются через синхронизацию
   */
  static toUpdateEntity(domain: Partial<ExpenseDomainEntity>): Partial<ExpenseTypeormEntity> {
    const updateData: Partial<ExpenseTypeormEntity> = {};

    // Поля из базы данных (локальные)
    if (domain.block_num !== undefined) updateData.block_num = domain.block_num;
    if (domain.present !== undefined) updateData.present = domain.present;

    // Примечание: Все поля из блокчейна (coopname, expense_hash, status, amount, description, etc.)
    // обновляются автоматически через систему синхронизации с блокчейном (AbstractEntitySyncService)
    // и не должны обновляться вручную через этот метод

    return updateData;
  }
}
