import { platformSettings } from '../config/platform-settings';

/**
 * Утилитарный класс для валидации валютных сумм
 * Проверяет соответствие символа валюты конфигурации системы
 */
export class CurrencyValidationUtil {
  /**
   * Проверяет, что сумма содержит правильный символ валюты
   * @param amount Сумма в формате "число символ" (например, "1000 RUB")
   * @returns boolean - true если символ валюты правильный
   */
  static hasValidCurrencySymbol(amount: string): boolean {
    if (!amount || typeof amount !== 'string') {
      return false;
    }

    const expectedSymbol = platformSettings().blockchain.rootGovernSymbol;
    return amount.includes(expectedSymbol);
  }

  /**
   * Валидирует сумму и выбрасывает ошибку, если символ валюты неправильный
   * @param amount Сумма в формате "число символ" (например, "1000 RUB")
   * @param fieldName Название поля для сообщения об ошибке (по умолчанию "сумма")
   * @throws Error если символ валюты неправильный
   */
  static validateCurrencySymbol(amount: string, fieldName = 'сумма'): void {
    if (!this.hasValidCurrencySymbol(amount)) {
      const expectedSymbol = platformSettings().blockchain.rootGovernSymbol;
      throw new Error(`Неверный символ валюты в ${fieldName}. Ожидался: ${expectedSymbol}`);
    }
  }

  /**
   * Извлекает символ валюты из суммы
   * @param amount Сумма в формате "число символ"
   * @returns string - символ валюты или пустая строка, если не найден
   */
  static extractCurrencySymbol(amount: string): string {
    if (!amount || typeof amount !== 'string') {
      return '';
    }

    const parts = amount.trim().split(' ');
    return parts.length > 1 ? parts[parts.length - 1] : '';
  }

  /**
   * Извлекает числовое значение из суммы
   * @param amount Сумма в формате "число символ"
   * @returns number - числовое значение или NaN, если не удалось распарсить
   */
  static extractAmountValue(amount: string): number {
    if (!amount || typeof amount !== 'string') {
      return NaN;
    }

    const parts = amount.trim().split(' ');
    const numericPart = parts.length > 1 ? parts[0] : amount;
    return parseFloat(numericPart);
  }

  /**
   * Форматирует сумму с правильным символом валюты
   * @param value Числовое значение
   * @param precision Количество знаков после запятой (по умолчанию из конфига)
   * @returns string - отформатированная сумма
   */
  static formatAmount(value: number, precision?: number): string {
    const actualPrecision = precision ?? config.blockchain.root_govern_precision;
    const symbol = platformSettings().blockchain.rootGovernSymbol;
    return `${value.toFixed(actualPrecision)} ${symbol}`;
  }
}
