import { platformSettings } from '../config/platform-settings';
import { DomainError } from '../errors/domain-error';

/**
 * Утилиты для работы с количествами и символами в платежной системе
 */
export class QuantityUtils {
  /**
   * Проверяет, поддерживается ли символ системой
   * @param symbol Символ для проверки
   * @returns true если символ поддерживается
   */
  static isSupportedSymbol(symbol: string): boolean {
    const { rootSymbol, rootGovernSymbol } = platformSettings().blockchain;
    return symbol === rootSymbol || symbol === rootGovernSymbol;
  }

  /**
   * Получает precision для конкретного символа
   * @param symbol Символ валюты
   * @returns Precision для символа
   */
  static getPrecisionForSymbol(symbol: string): number {
    const { rootSymbol, rootPrecision, rootGovernSymbol, rootGovernPrecision } = platformSettings().blockchain;

    if (symbol === rootSymbol) {
      return rootPrecision;
    } else if (symbol === rootGovernSymbol) {
      return rootGovernPrecision;
    } else {
      throw DomainError.badRequest('KIT_SYMBOL_UNSUPPORTED', { symbol, rootSymbol, rootGovernSymbol });
    }
  }

  /**
   * Валидирует символ и выбрасывает ошибку если не поддерживается
   * @param symbol Символ для валидации
   */
  static validateSymbol(symbol: string): void {
    if (!this.isSupportedSymbol(symbol)) {
      const { rootSymbol, rootGovernSymbol } = platformSettings().blockchain;
      throw DomainError.badRequest('KIT_SYMBOL_UNSUPPORTED', { symbol, rootSymbol, rootGovernSymbol });
    }
  }

  /**
   * Форматирует количество с символом для блокчейна
   * @param amount Числовое значение
   * @param symbol Символ валюты
   * @returns Отформатированная строка quantity для блокчейна
   */
  static formatQuantityForBlockchain(amount: number, symbol: string): string {
    this.validateSymbol(symbol);

    if (isNaN(amount) || amount < 0) {
      throw DomainError.badRequest('KIT_NUMBER_INVALID', { value: amount });
    }

    const precision = this.getPrecisionForSymbol(symbol);
    const formattedAmount = amount.toFixed(precision);

    return `${formattedAmount} ${symbol}`;
  }

  /**
   * Форматирует количество с символом из числа и строки символа в единую строку
   * @param amount Числовое значение
   * @param symbol Символ валюты
   * @returns Строка в формате "число символ"
   */
  static combineQuantityAndSymbol(amount: number, symbol: string): string {
    this.validateSymbol(symbol);

    if (isNaN(amount) || amount < 0) {
      throw DomainError.badRequest('KIT_NUMBER_INVALID', { value: amount });
    }

    return `${amount} ${symbol}`;
  }

  /**
   * Парсит строку quantity в число и символ
   * @param quantity Строка в формате "число символ"
   * @returns Объект с числом и символом
   */
  static parseQuantityString(quantity: string): { amount: number; symbol: string } {
    const parts = quantity.split(' ');
    if (parts.length !== 2) {
      throw DomainError.badRequest('KIT_QUANTITY_FORMAT_INVALID', { quantity });
    }

    const [amountStr, symbol] = parts;
    const amount = parseFloat(amountStr);

    if (isNaN(amount)) {
      throw DomainError.badRequest('KIT_QUANTITY_AMOUNT_INVALID', { amount: amountStr });
    }

    this.validateSymbol(symbol);

    return { amount, symbol };
  }
}
