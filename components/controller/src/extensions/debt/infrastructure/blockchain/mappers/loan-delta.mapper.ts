import { Inject, Injectable } from '@nestjs/common';
import { LOGGER_PORT, type ILoggerPort, type ISignedDocument } from '@coopenomics/innercoop';
import { AbstractBlockchainDeltaMapper, type IDelta } from '@coopenomics/extension-kit/sync';
import { DomainToBlockchainUtils } from '@coopenomics/extension-kit';
import type { DebtContract } from 'cooptypes';
import { LoanDomainEntity } from '../../../domain/entities/loan.entity';
import type { ILoanBlockchainData } from '../../../domain/interfaces/loan-blockchain.interface';
import { DebtContractInfoService } from '../../services/debt-contract-info.service';

const DOCUMENT_FIELDS = ['statement', 'contract', 'signed_contract', 'decision', 'extension_statement'] as const;

/** Маппер дельт таблицы `debt::debts` в блокчейн-данные займа. */
@Injectable()
export class LoanDeltaMapper extends AbstractBlockchainDeltaMapper<ILoanBlockchainData, LoanDomainEntity> {
  constructor(
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort,
    private readonly contractInfo: DebtContractInfoService
  ) {
    super();
    this.logger.setContext(LoanDeltaMapper.name);
  }

  mapDeltaToBlockchainData(delta: IDelta): ILoanBlockchainData | null {
    try {
      const value = delta.value as DebtContract.Tables.Debts.IDebt | undefined;
      if (!value) {
        this.logger.warn(`Delta has no value: table=${delta.table}, key=${delta.primary_key}`);
        return null;
      }
      const documents: Partial<Record<(typeof DOCUMENT_FIELDS)[number], ISignedDocument | undefined>> = {};
      for (const field of DOCUMENT_FIELDS) {
        const raw = value[field];
        // Пустой документ цепи (без хэша) в зеркало не кладём.
        documents[field] = raw && raw.hash && !/^0+$/.test(String(raw.hash))
          ? DomainToBlockchainUtils.convertChainDocumentToDomainFormat(raw as never)
          : undefined;
      }
      return {
        id: value.id,
        coopname: value.coopname,
        username: value.username,
        status: String(value.status),
        debt_hash: String(value.debt_hash).toLowerCase(),
        collateral: value.collateral,
        source: value.source,
        source_ref: String(value.source_ref).toLowerCase(),
        amount: value.amount,
        remaining: value.remaining,
        pledged: value.pledged,
        created_at: value.created_at,
        issued_at: value.issued_at,
        due_at: value.due_at,
        requested_due_at: value.requested_due_at,
        overdue_at: value.overdue_at,
        last_pay_error: value.last_pay_error,
        memo: value.memo,
        ...documents,
      };
    } catch (error: any) {
      this.logger.error(`Error mapping delta to blockchain data: ${error.message}`, error.stack);
      return null;
    }
  }

  extractSyncValue(delta: IDelta): string {
    if (!delta.value || !delta.value[this.extractSyncKey()]) {
      throw new Error(`Delta has no value: table=${delta.table}, key=${this.extractSyncKey()}`);
    }
    return String(delta.value[this.extractSyncKey()]).toLowerCase();
  }

  extractSyncKey(): string {
    return LoanDomainEntity.getSyncKey();
  }

  getSupportedContractNames(): string[] {
    return this.contractInfo.getSupportedContractNames();
  }

  getSupportedTableNames(): string[] {
    return this.contractInfo.getTablePatterns('debts');
  }
}
