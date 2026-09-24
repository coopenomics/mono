import { t } from '../../i18n';

/** «9 месяцев» — длительность курса словами; пусто у курса без конечной программы. */
export function courseMonthsLabel(months: number | null | undefined): string {
  const n = Number(months ?? 0);
  return n > 0 ? t('datetime.relative.months', n) : '';
}
