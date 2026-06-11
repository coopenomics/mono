import { Injectable } from '@nestjs/common';

/**
 * Сервис информации о поддерживаемых контрактах и таблицах для модуля КУ.
 * Источник данных — контракт branch (собрания/решения участков и заявки доверенных).
 */
@Injectable()
export class KuContractInfoService {
  private readonly supportedContractNames: string[] = ['branch'];

  /**
   * Паттерны таблиц для каждой сущности (базовое имя + маска)
   */
  private readonly tablePatterns: Record<string, string[]> = {
    decisions: ['decisions', 'decisions*'],
    decisionq: ['decisionq', 'decisionq*'],
    trustreqs: ['trustreqs', 'trustreqs*'],
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
