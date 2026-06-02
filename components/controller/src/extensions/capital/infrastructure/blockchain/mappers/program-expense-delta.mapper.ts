import { Injectable } from '@nestjs/common';
import type { IDelta } from '~/types/common';
import { ProgramExpenseDomainEntity } from '../../../domain/entities/program-expense.entity';
import type { IProgramExpenseBlockchainData } from '../../../domain/interfaces/program-expense-blockchain.interface';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { CapitalContractInfoService } from '../../services/capital-contract-info.service';
import { AbstractBlockchainDeltaMapper } from '~/shared/abstract-blockchain-delta.mapper';
import { DomainToBlockchainUtils } from '~/shared/utils/domain-to-blockchain.utils';
import type { CapitalContract } from 'cooptypes';

@Injectable()
export class ProgramExpenseDeltaMapper extends AbstractBlockchainDeltaMapper<
  IProgramExpenseBlockchainData,
  ProgramExpenseDomainEntity
> {
  constructor(
    private readonly logger: WinstonLoggerService,
    private readonly contractInfo: CapitalContractInfoService,
  ) {
    super();
    this.logger.setContext(ProgramExpenseDeltaMapper.name);
  }

  mapDeltaToBlockchainData(delta: IDelta): IProgramExpenseBlockchainData | null {
    try {
      const value = delta.value as CapitalContract.Tables.ProgramExpenses.IProgramExpense;
      if (!value) {
        this.logger.warn(`Delta has no value: table=${delta.table}, key=${delta.primary_key}`);
        return null;
      }

      const expense_statement = DomainToBlockchainUtils.convertChainDocumentToDomainFormat(value.expense_statement);
      const approved_statement = DomainToBlockchainUtils.convertChainDocumentToDomainFormat(value.approved_statement);
      const authorization = DomainToBlockchainUtils.convertChainDocumentToDomainFormat(value.authorization);

      return { ...value, expense_statement, approved_statement, authorization };
    } catch (error: any) {
      this.logger.error(`Error mapping delta to blockchain data: ${error.message}`, error.stack);
      return null;
    }
  }

  extractSyncValue(delta: IDelta): string {
    if (!delta.value || !delta.value[this.extractSyncKey()]) {
      throw new Error(`Delta has no value: table=${delta.table}, key=${this.extractSyncKey()}`);
    }
    return delta.value[this.extractSyncKey()];
  }

  extractSyncKey(): string {
    return ProgramExpenseDomainEntity.getSyncKey();
  }

  getSupportedContractNames(): string[] {
    return this.contractInfo.getSupportedContractNames();
  }

  getSupportedTableNames(): string[] {
    return this.contractInfo.getTablePatterns('progexpenses');
  }
}
