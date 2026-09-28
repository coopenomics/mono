import { DomainError } from '@coopenomics/extension-kit';
/**
 * Утилиты для сравнения сумм с валютами
 */
export class AmountComparisonUtils {
  /**
   * Парсит строку суммы в формате "число валюта" на компоненты
   * @param amountStr Строка в формате "число валюта" (например, "1000.00 RUB")
   * @returns Объект с числом и валютой
   * @throws Error если формат некорректный
   */
  static parseAmountAndCurrency(amountStr: string): { amount: number; currency: string } {
    const parts = amountStr.split(' ');
    if (parts.length !== 2) {
      throw DomainError.badRequest('AMOUNT_FORMAT_INVALID', { amountStr });
    }

    const [amountPart, currency] = parts;
    const amount = parseFloat(amountPart);

    if (isNaN(amount)) {
      throw DomainError.badRequest('AMOUNT_VALUE_INVALID', { amountPart });
    }

    return { amount, currency };
  }

  /**
   * Сравнивает две суммы с валютами на полное совпадение (число и валюта)
   * @param amount1 Первая сумма в формате "число валюта"
   * @param amount2 Вторая сумма в формате "число валюта"
   * @throws Error если суммы не совпадают по числу или валюте
   */
  static validateAmountsMatch(amount1: string, amount2: string): void {
    const data1 = this.parseAmountAndCurrency(amount1);
    const data2 = this.parseAmountAndCurrency(amount2);

    // Сравниваем числа
    if (data1.amount !== data2.amount) {
      throw DomainError.internal('AMOUNT_DOCUMENT_MISMATCH');
    }

    // Сравниваем валюты
    if (data1.currency !== data2.currency) {
      throw DomainError.internal('AMOUNT_CURRENCY_MISMATCH');
    }
  }

  /**
   * Проверяет, совпадают ли две суммы (число и валюта)
   * @param amount1 Первая сумма в формате "число валюта"
   * @param amount2 Вторая сумма в формате "число валюта"
   * @returns true если суммы полностью совпадают
   */
  static areAmountsEqual(amount1: string, amount2: string): boolean {
    try {
      this.validateAmountsMatch(amount1, amount2);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Извлекает числовую часть из строки суммы
   * @param amountStr Строка в формате "число валюта"
   * @returns Числовое значение
   */
  static extractAmount(amountStr: string): number {
    const { amount } = this.parseAmountAndCurrency(amountStr);
    return amount;
  }

  /**
   * Извлекает валюту из строки суммы
   * @param amountStr Строка в формате "число валюта"
   * @returns Строка валюты
   */
  static extractCurrency(amountStr: string): string {
    const { currency } = this.parseAmountAndCurrency(amountStr);
    return currency;
  }
}
