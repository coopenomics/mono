/**
 * Truncate (toward-zero) числовой строки до displayPrecision знаков
 * после запятой — на уровне строки, без преобразования в Number, чтобы
 * избежать FP-погрешности (например, 0.29 * 100 = 28.999999999999996 в IEEE 754).
 *
 * Принцип: «никогда не показать пользователю сумму больше, чем реально
 * есть на кошельке». 99999.9999 → "99999.99" (а не "100000.00", как
 * сделал бы math-round). Применяется как для отображения asset
 * (precision=4 → display=2), так и для подготовки input при отправке
 * в контракт (не превысить ввод пользователя/доступный баланс).
 *
 * @param numericString — десятичная строка без валюты, e.g. "99999.9999" или "-12.5"
 * @param displayPrecision — сколько знаков оставить (по умолчанию 2)
 */
export const floorDecimalString = (numericString: string, displayPrecision = 2): string => {
  const trimmed = numericString.trim();
  const negative = trimmed.startsWith('-');
  const abs = negative ? trimmed.slice(1) : trimmed;
  const [intPartRaw, decPartRaw = ''] = abs.split('.');
  const intPart = intPartRaw || '0';
  const decPart = decPartRaw.padEnd(displayPrecision, '0').slice(0, displayPrecision);
  const result = displayPrecision > 0 ? `${intPart}.${decPart}` : intPart;
  return negative ? `-${result}` : result;
};
