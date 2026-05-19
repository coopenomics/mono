import { floorDecimalString } from './floorDecimalString';

/**
 * Конвертирует число/строку в asset-строку с заданной precision (по умолчанию 4)
 * для отправки в контракт.
 *
 * Использует truncate (toward-zero), не math-round: чтобы пользователь не
 * мог случайно превысить свой ввод или доступный баланс. Например, ввод
 * 99.99999 RUB при precision=4 даёт "99.9999 RUB" (не "100.0000").
 */
export function formatToAsset(amount: string | number, currency: string, precision = 4): string {
  const num = typeof amount === 'number' ? amount : parseFloat(amount);
  if (isNaN(num)) return `0.${'0'.repeat(precision)} ${currency}`;
  const padded = num.toFixed(precision + 4);
  const formattedAmount = floorDecimalString(padded, precision);
  return `${formattedAmount} ${currency}`;
}
