import { Injectable } from '@nestjs/common';

/**
 * Информация о поддерживаемых контрактах/таблицах модуля ledger2 (Эпик 3).
 */
@Injectable()
export class Ledger2ContractInfoService {
  private readonly supportedContractNames: string[] = ['ledger2'];

  private readonly tablePatterns: Record<string, string[]> = {
    userwallets: ['userwallets', 'userwallets*'],
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

  isContractSupported(contractName: string): boolean {
    return this.supportedContractNames.includes(contractName);
  }
}
