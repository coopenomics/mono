import { Injectable } from '@nestjs/common';
import { DebtContract } from 'cooptypes';

/** Имена контракта и таблиц для подписки на дельты parser2. */
@Injectable()
export class DebtContractInfoService {
  private readonly supportedContractNames: string[] = [DebtContract.contractName.production];

  private readonly tablePatterns: Record<string, string[]> = {
    debts: [DebtContract.Tables.Debts.tableName, `${DebtContract.Tables.Debts.tableName}*`],
  };

  getSupportedContractNames(): string[] {
    return [...this.supportedContractNames];
  }

  getTablePatterns(entityName: string): string[] {
    const patterns = this.tablePatterns[entityName];
    if (!patterns) {
      throw new Error(`Unknown entity name: ${entityName}. Supported entities: ${Object.keys(this.tablePatterns).join(', ')}`);
    }
    return [...patterns];
  }
}
