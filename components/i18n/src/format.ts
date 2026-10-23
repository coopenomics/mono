import { DEFAULT_LOCALE, PSEUDO_LOCALE } from './locales';

/**
 * Язык платформы → тег для `Intl`. Числа и даты форматирует браузер или Node
 * по правилам этого тега: разделители разрядов, запятая в дробях, порядок
 * частей даты.
 */
const INTL_TAGS: Record<string, string> = {
  ru: 'ru-RU',
  [PSEUDO_LOCALE]: 'ru-RU',
};

export function intlLocale(locale: string = DEFAULT_LOCALE): string {
  return INTL_TAGS[locale] ?? locale;
}

/** Число по правилам языка: `1234567.5` → `1 234 567,5`. */
export function formatNumber(
  value: number | bigint,
  options?: Intl.NumberFormatOptions,
  locale: string = DEFAULT_LOCALE,
): string {
  return new Intl.NumberFormat(intlLocale(locale), options).format(value);
}

/** Разделитель дробной части языка: `,` для русского. */
export function decimalSeparator(locale: string = DEFAULT_LOCALE): string {
  const part = new Intl.NumberFormat(intlLocale(locale))
    .formatToParts(1.5)
    .find((p) => p.type === 'decimal');
  return part?.value ?? '.';
}

/**
 * Группирует целую часть и приклеивает дробную как есть — без округления.
 * Нужна для сумм: `'1234567'`, `'05'` → `1 234 567,05`. Строки, а не числа,
 * потому что сумма с цепи не обязана помещаться в double.
 */
export function formatDecimalParts(
  integer: string,
  fraction: string | undefined,
  locale: string = DEFAULT_LOCALE,
): string {
  const negative = integer.startsWith('-');
  const digits = negative ? integer.slice(1) : integer;
  const grouped = formatNumber(BigInt(digits || '0'), undefined, locale);
  const sign = negative ? '-' : '';
  return fraction === undefined || fraction === ''
    ? `${sign}${grouped}`
    : `${sign}${grouped}${decimalSeparator(locale)}${fraction}`;
}
