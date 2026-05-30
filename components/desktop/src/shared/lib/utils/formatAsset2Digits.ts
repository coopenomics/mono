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

/**
 * Регэксп для актива внутри свободного текста: целое.дробное (≥3 знаков)
 * + пробел + тикер. Требование ≥3 знаков таргетит «сырой» on-chain рендер
 * `asset::to_string()` (precision=4 для RUB → "100.0000"), но не трогает
 * уже корректные 2-значные суммы и числа вроде "12.5". Тикер — 3..7
 * заглавных латинских (RUB, AXON), как EOSIO symbol_code.
 */
const ASSET_IN_TEXT_RE = /(\d+\.\d{3,})\s+([A-Z]{3,7})/g;

/**
 * Переформатирует все суммы-активы внутри произвольной строки (текста
 * ошибки с бэкенда/цепи) к виду «2 знака + группировка» через
 * {@link formatAsset2Digits}:
 *   "Недостаточно средств: требуется 100.0000 RUB, доступно 0.0000 RUB"
 *   → "Недостаточно средств: требуется 100,00 RUB, доступно 0,00 RUB".
 *
 * Идемпотентна: уже отформатированные суммы (<3 знаков после точки) не
 * трогает. Применяется централизованно в тостах ошибок (см. FailAlert).
 *
 * @param text — произвольный текст, возможно содержащий суммы-активы
 * @returns текст с переформатированными суммами
 */
export const formatAssetsInText = (text: string): string => {
  if (!text) return text;

  return text.replace(
    ASSET_IN_TEXT_RE,
    (_match, amount: string, symbol: string) =>
      formatAsset2Digits(`${amount} ${symbol}`),
  );
};
