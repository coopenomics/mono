import { uiLocale } from 'src/shared/i18n';
import { t } from '../../i18n';
/**
 * Компактное форматирование метрик проекта/компонента для строк списка
 * Мастерской: часы «факт / план» и привлечённые инвестиции.
 */

const parseAssetAmount = (value?: string | number | null): number => {
  if (value === undefined || value === null) return 0;
  const numeric = parseFloat(String(value).split(' ')[0] || '0');
  return isNaN(numeric) ? 0 : numeric;
};

const compactFormatter = new Intl.NumberFormat(uiLocale(), {
  notation: 'compact',
  maximumFractionDigits: 1,
});

/** «12,5 тыс» из "12500.0000 RUB" / числа; «0» для пустого */
export const formatCompactAmount = (value?: string | number | null): string =>
  compactFormatter.format(parseAssetAmount(value));

const hoursFormatter = new Intl.NumberFormat(uiLocale(), {
  maximumFractionDigits: 1,
});

/** Часы «фактч / планч» по пулам проекта — формат синхронен с
 *  инлайн-чипом времени задачи (IssueTimeChip) */
export const formatHoursFactPlan = (
  fact?: string | number | null,
  plan?: string | number | null,
): string =>
  t('capital.formatProjectMeta.hoursFactPlan', { factHours: hoursFormatter.format(parseAssetAmount(fact)), planHours: hoursFormatter.format(parseAssetAmount(plan)) });

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
