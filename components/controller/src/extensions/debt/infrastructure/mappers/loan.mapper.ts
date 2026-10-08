import { LoanDomainEntity } from '../../domain/entities/loan.entity';
import { LoanRecord } from '../entities/loan.record';
import type { ILoanDatabaseData } from '../../domain/interfaces/loan-database.interface';
import type { ILoanBlockchainData } from '../../domain/interfaces/loan-blockchain.interface';
import { LoanStatus } from '../../domain/enums/loan-status.enum';

const CHAIN_EPOCH = '1970-01-01T00:00:00';

function toDate(value?: string): Date | null {
  if (!value || value.startsWith('1970')) return null;
  return new Date(value.endsWith('Z') ? value : `${value}Z`);
}

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
      status: entity.status ?? LoanStatus.UNDEFINED,
      _created_at: entity._created_at,
      _updated_at: entity._updated_at,
    };

    let blockchainData: ILoanBlockchainData | undefined;
    // id=0 — допустимый ключ цепи, проверяем на null, не на истинность.
    if (entity.id != null) {
      blockchainData = {
        id: entity.id,
        coopname: entity.coopname,
        username: entity.username,
        status: entity.blockchain_status ?? '',
        debt_hash: entity.debt_hash,
        collateral: entity.collateral ?? '',
        source: entity.source ?? '',
        source_ref: entity.source_ref ?? '',
        amount: entity.amount ?? '',
        remaining: entity.remaining ?? '',
        pledged: entity.pledged ?? '',
        created_at: toChainTime(entity.created_at),
        issued_at: toChainTime(entity.issued_at),
        due_at: toChainTime(entity.due_at),
        requested_due_at: toChainTime(entity.requested_due_at),
        overdue_at: toChainTime(entity.overdue_at),
        statement: entity.statement ?? undefined,
        contract: entity.contract ?? undefined,
        signed_contract: entity.signed_contract ?? undefined,
        decision: entity.decision ?? undefined,
        extension_statement: entity.extension_statement ?? undefined,
        last_pay_error: entity.last_pay_error ?? '',
        memo: entity.memo ?? '',
      };
    }

    return new LoanDomainEntity(databaseData, blockchainData);
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

    if (domain.id !== undefined) {
      const bcPart: Partial<LoanRecord> = {
        id: domain.id,
        username: domain.username,
        blockchain_status: domain.blockchain_status ?? null,
        collateral: domain.collateral ?? null,
        source: domain.source ?? null,
        source_ref: domain.source_ref ?? null,
        amount: domain.amount ?? null,
        remaining: domain.remaining ?? null,
        pledged: domain.pledged ?? null,
        created_at: toDate(domain.created_at),
        issued_at: toDate(domain.issued_at),
        due_at: toDate(domain.due_at),
        requested_due_at: toDate(domain.requested_due_at),
        overdue_at: toDate(domain.overdue_at),
        statement: domain.statement ?? null,
        contract: domain.contract ?? null,
        signed_contract: domain.signed_contract ?? null,
        decision: domain.decision ?? null,
        extension_statement: domain.extension_statement ?? null,
        last_pay_error: domain.last_pay_error ?? null,
        memo: domain.memo ?? null,
      };
      return { ...dbPart, ...bcPart };
    }

    return dbPart;
  }
}
