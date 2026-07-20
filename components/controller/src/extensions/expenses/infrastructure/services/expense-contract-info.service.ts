import { Injectable } from '@nestjs/common';

/**
 * Сервис паттернов имён контрактов и таблиц для расширения `expense`.
 * Аналог `CapitalContractInfoService` — централизует масочные паттерны
 * для parser2 subscribe.
 */
@Injectable()
export class ExpenseContractInfoService {
  private readonly supportedContractNames: string[] = ['expense'];

  private readonly tablePatterns: Record<string, string[]> = {
    proposals: ['proposals', 'proposals*'],
  };

  getSupportedContractNames(): string[] {
    return [...this.supportedContractNames];
  }

  getTablePatterns(entityName: string): string[] {
    const patterns = this.tablePatterns[entityName];
    if (!patterns) {
      throw new Error(
        `Unknown entity name: ${entityName}. Supported entities: ${Object.keys(this.tablePatterns).join(', ')}`
      );
    }
    return [...patterns];
  }
}
