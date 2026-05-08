import { Injectable } from '@nestjs/common';

/**
 * Информация о поддерживаемых контрактах/таблицах модуля wallet (Эпик 2).
 *
 * Используется sync-сервисами и delta-mapper'ами для подписки на дельты.
 */
@Injectable()
export class WalletContractInfoService {
  private readonly supportedContractNames: string[] = ['wallet'];

  private readonly tablePatterns: Record<string, string[]> = {
    users: ['users', 'users*'],
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
