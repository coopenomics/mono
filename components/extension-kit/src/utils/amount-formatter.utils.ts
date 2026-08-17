/**
 * Утилиты для форматирования сумм в человекочитаемый вид
 * (уведомления, печатные документы, UI-тексты).
 *
 * Канон отображения: 2 знака после запятой, группировка разрядов,
 * запятая как десятичный разделитель (ru-RU) —
 * «1000.0000 RUB» → «1 000,00 RUB».
 */
export class AmountFormatterUtils {
  /**
   * Форматирует сумму в читаемый формат.
   * @param amountStr Строка «число» или «число валюта»
   *   (например, «1000.0000», «1000.0000 RUB»)
   * @returns «1 000,00» или «1 000,00 RUB»
   * @throws Error если формат некорректный
   */
  static formatAmount(amountStr: string): string {
    if (!amountStr || typeof amountStr !== 'string') {
      throw new Error(`Неверный формат суммы: ${amountStr}. Ожидается "число" или "число валюта"`);
    }

    const parts = amountStr.trim().split(/\s+/);
    if (parts.length < 1 || !parts[0]) {
      throw new Error(`Неверный формат суммы: ${amountStr}. Ожидается "число" или "число валюта"`);
    }

    const amountPart = parts[0].replace(',', '.');
    const currency = parts.length >= 2 ? parts.slice(1).join(' ') : '';
    const amount = parseFloat(amountPart);

    if (isNaN(amount)) {
      throw new Error(`Некорректное числовое значение в сумме: ${parts[0]}`);
    }

    const formattedAmount = amount.toLocaleString('ru-RU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    return currency ? `${formattedAmount} ${currency}` : formattedAmount;
  }

  /**
   * То же, что {@link formatAmount}, но без throw: при сбое возвращает
   * исходную строку. Для non-blocking путей (уведомления), где ошибка
   * форматирования не должна рвать доставку.
   */
  static formatAmountSafe(amountStr: string | undefined | null): string {
    if (amountStr == null || amountStr === '') {
      return '';
    }
    try {
      return this.formatAmount(amountStr);
    } catch {
      return amountStr;
    }
  }
}
