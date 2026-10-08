import { LoanDomainEntity } from '../../domain/entities/loan.entity';
import { LoanRecord } from '../entities/loan.record';
import type { ILoanDatabaseData } from '../../domain/interfaces/loan-database.interface';
import type { ILoanBlockchainData } from '../../domain/interfaces/loan-blockchain.interface';
import type { DebtContract } from 'cooptypes';

const CHAIN_EPOCH = '1970-01-01T00:00:00';

function toDate(value?: string): Date | null {
  if (!value || value.startsWith('1970')) return null;
  return new Date(value.endsWith('Z') ? value : `${value}Z`);
}

/** Пустое значение колонки → пустая строка цепи. */
const text = (value: string | null | undefined): string => value ?? '';
/** Пустое значение колонки → отсутствие поля. */
const optional = <T>(value: T | null | undefined): T | undefined => value ?? undefined;
/** Отсутствие поля → пустая колонка. */
const column = <T>(value: T | null | undefined): T | null => value ?? null;

function toChainTime(value: Date | null): string {
  return value ? value.toISOString().slice(0, 19) : CHAIN_EPOCH;
}

/** Маппер `LoanRecord` ↔ `LoanDomainEntity`. */
export class LoanMapper {
  static toDomain(entity: LoanRecord): LoanDomainEntity {
    const databaseData: ILoanDatabaseData = {
      _id: entity._id,
      block_num: entity.block_num,
      present: entity.present,
      debt_hash: entity.debt_hash,
      coopname: entity.coopname,
      status: entity.status,
      _created_at: entity._created_at,
      _updated_at: entity._updated_at,
    };

    // id=0 — допустимый ключ цепи, проверяем на null, не на истинность.
    const blockchainData = entity.id != null ? LoanMapper.chainPart(entity) : undefined;

    return new LoanDomainEntity(databaseData, blockchainData);
  }

  private static chainPart(entity: LoanRecord): ILoanBlockchainData {
    return {
      id: entity.id as number,
      coopname: entity.coopname,
      username: entity.username,
      status: text(entity.blockchain_status) as DebtContract.Status,
      debt_hash: entity.debt_hash,
      collateral: text(entity.collateral),
      source: text(entity.source),
      source_ref: text(entity.source_ref),
      amount: text(entity.amount),
      remaining: text(entity.remaining),
      pledged: text(entity.pledged),
      created_at: toChainTime(entity.created_at),
      issued_at: toChainTime(entity.issued_at),
      due_at: toChainTime(entity.due_at),
      requested_due_at: toChainTime(entity.requested_due_at),
      overdue_at: toChainTime(entity.overdue_at),
      statement: optional(entity.statement),
      contract: optional(entity.contract),
      signed_contract: optional(entity.signed_contract),
      decision: optional(entity.decision),
      extension_statement: optional(entity.extension_statement),
      last_pay_error: text(entity.last_pay_error),
      memo: text(entity.memo),
    };
  }

  private static recordChainPart(domain: LoanDomainEntity): Partial<LoanRecord> {
    return {
      id: domain.id,
      username: domain.username,
      blockchain_status: column(domain.blockchain_status),
      collateral: column(domain.collateral),
      source: column(domain.source),
      source_ref: column(domain.source_ref),
      amount: column(domain.amount),
      remaining: column(domain.remaining),
      pledged: column(domain.pledged),
      created_at: toDate(domain.created_at),
      issued_at: toDate(domain.issued_at),
      due_at: toDate(domain.due_at),
      requested_due_at: toDate(domain.requested_due_at),
      overdue_at: toDate(domain.overdue_at),
      statement: column(domain.statement),
      contract: column(domain.contract),
      signed_contract: column(domain.signed_contract),
      decision: column(domain.decision),
      extension_statement: column(domain.extension_statement),
      last_pay_error: column(domain.last_pay_error),
      memo: column(domain.memo),
    };
  }

  static toEntity(domain: LoanDomainEntity): Partial<LoanRecord> {
    const dbPart: Partial<LoanRecord> = {
      _id: domain._id,
      block_num: domain.block_num ?? 0,
      present: domain.present,
      debt_hash: domain.debt_hash,
      coopname: domain.coopname,
      status: domain.status,
      _created_at: domain._created_at as Date,
      _updated_at: domain._updated_at as Date,
    };

    if (domain.id !== undefined) return { ...dbPart, ...LoanMapper.recordChainPart(domain) };

    return dbPart;
  }
}
