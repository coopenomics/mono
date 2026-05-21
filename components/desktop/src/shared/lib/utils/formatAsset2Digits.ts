import { floorDecimalString } from './floorDecimalString';

/**
 * Форматирует актив для отображения: truncate (toward-zero) до 2 знаков
 * после запятой + локальная группировка разрядов (ru-RU).
 *
 * Truncate, а не math-round: 99999.9999 → "99 999,99" (не "100 000,00").
 * Никогда не показываем пользователю сумму больше, чем реально доступна
 * на кошельке — иначе попытка инвестировать «весь баланс» упирается
 * в `walletop TRANSFER: insufficient funds` из-за расхождения precision=4
 * на цепи и precision=2 в UI.
 *
 * @param value — строка с активом (например "99999.9999 RUB")
 * @returns отформатированная строка (например "99 999,99 RUB")
 */
export const formatAsset2Digits = (value: string): string => {
  if (!value || value === '0') return '0.00';

  const parts = value.trim().split(' ');
  const cleanValue = parts[0] || value;
  const currencySymbol = parts[1] || '';
  const numericValue = cleanValue.replace(/[^\d.-]/g, '');

  if (!numericValue || numericValue === '-' || isNaN(parseFloat(numericValue))) {
    return '0.00';
  }

  const truncated = floorDecimalString(numericValue, 2);
  const negative = truncated.startsWith('-');
  const abs = negative ? truncated.slice(1) : truncated;
  const [intStr, decStr] = abs.split('.');
  const intGrouped = new Intl.NumberFormat('ru-RU').format(BigInt(intStr));
  const formattedNumber = `${negative ? '-' : ''}${intGrouped},${decStr}`;

  return currencySymbol
    ? `${formattedNumber} ${currencySymbol}`
    : formattedNumber;
};
