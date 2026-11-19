import { uiLocale } from 'src/shared/i18n';

/**
 * Сумма заказа для заказчика: «1 380 ₽». Одна запись на карточку заказа и
 * страницу «Заказ оформлен» — суммы в обоих местах читаются одинаково.
 */
export function formatOrderPrice(value: number): string {
  return new Intl.NumberFormat(uiLocale(), { minimumFractionDigits: 0 }).format(value) + ' ₽';
}
