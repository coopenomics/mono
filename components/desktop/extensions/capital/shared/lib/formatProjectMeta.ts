/**
 * Компактное форматирование метрик проекта/компонента для строк списка
 * Мастерской: часы «факт / план» и привлечённые инвестиции.
 */

const parseAssetAmount = (value?: string | number | null): number => {
  if (value === undefined || value === null) return 0;
  const numeric = parseFloat(String(value).split(' ')[0] || '0');
  return isNaN(numeric) ? 0 : numeric;
};

const compactFormatter = new Intl.NumberFormat('ru-RU', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

/** «12,5 тыс» из "12500.0000 RUB" / числа; «0» для пустого */
export const formatCompactAmount = (value?: string | number | null): string =>
  compactFormatter.format(parseAssetAmount(value));

const hoursFormatter = new Intl.NumberFormat('ru-RU', {
  maximumFractionDigits: 1,
});

/** Часы «фактч / планч» по пулам проекта — формат синхронен с
 *  инлайн-чипом времени задачи (IssueTimeChip) */
export const formatHoursFactPlan = (
  fact?: string | number | null,
  plan?: string | number | null,
): string =>
  `${hoursFormatter.format(parseAssetAmount(fact))}ч / ${hoursFormatter.format(parseAssetAmount(plan))}ч`;

/** Инвестиции «факт / план» компактно */
export const formatInvestFactPlan = (
  fact?: string | number | null,
  plan?: string | number | null,
): string => `${formatCompactAmount(fact)} / ${formatCompactAmount(plan)}`;

/** Есть ли смысл показывать инвестиционную метрику (что-то ненулевое) */
export const hasInvestMeta = (
  fact?: string | number | null,
  plan?: string | number | null,
): boolean => parseAssetAmount(fact) > 0 || parseAssetAmount(plan) > 0;
