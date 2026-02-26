import { Injectable } from '@nestjs/common';

/**
 * Сервис предоставляющий информацию о поддерживаемых контрактах и таблицах для Capital модуля
 *
 * Централизует информацию о версиях контрактов и таблицах для повторного использования
 */
@Injectable()
export class CapitalContractInfoService {
  /**
   * Поддерживаемые версии контрактов Capital
   * При добавлении новой версии контракта - добавьте её сюда
   */
  private readonly supportedContractNames: string[] = ['capital'];

  /**
   * Паттерны таблиц для каждой сущности
   * Каждая сущность имеет базовое имя таблицы и паттерн с маской
   */
  private readonly tablePatterns: Record<string, string[]> = {
    // Сущности с именами ≤ 12 символов
    commits: ['commits', 'commits*'],
    appendixes: ['appendixes', 'appendixes*'],
    expenses: ['expenses', 'expenses*'],
    pgproperties: ['pgproperties', 'pgproperties*'],
    pjproperties: ['pjproperties', 'pjproperties*'],
    results: ['results', 'results*'],
    projwallets: ['projwallets', 'projwallets*'],
    invests: ['invests', 'invests*'],
    capwallets: ['capwallets', 'capwallets*'],
    projects: ['projects', 'projects*'],
    debts: ['debts', 'debts*'],
    votes: ['votes', 'votes*'],
    contributors: ['contributors', 'contributor*'], // Особый случай - укороченный паттерн
    segments: ['segments', 'segments*'],
    state: ['state', 'state*'],

    // Сущности с именами = 12 символов (удаляем последний символ и добавляем *)
    prgwithdraws: ['prgwithdraws', 'prgwithdraw*'],
    progrinvests: ['progrinvests', 'progrinvest*'],
  };

  /**
   * Получение всех поддерживаемых имен контрактов
   */
  getSupportedContractNames(): string[] {
    return [...this.supportedContractNames];
  }

  /**
   * Получение паттернов таблиц для указанной сущности
   * @param entityName - имя сущности
   */
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
