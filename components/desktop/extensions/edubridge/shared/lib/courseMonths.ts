import { t } from '../../i18n';

/** «9 месяцев» — длительность курса словами; пусто у курса без конечной программы. */
export function courseMonthsLabel(months: number | null | undefined): string {
  const n = Number(months ?? 0);
  return n > 0 ? t('datetime.relative.months', n) : '';
}

const WEEKS_IN_MONTH = 4;

/**
 * Длительность программы словами: занятия программы, делённые на занятия в
 * месяц. Счёт идёт неделями, месяц — четыре недели; неполная неделя считается
 * неделей. «1 неделя», «1 месяц», «1 месяц 2 недели». Пусто, когда числа
 * занятий не заданы.
 */
export function programSpanLabel(lessonsPerMonth: unknown, lessonsTotal: unknown): string {
  const perMonth = Number(lessonsPerMonth || 0);
  const total = Number(lessonsTotal || 0);
  if (!(perMonth > 0) || !(total > 0)) return '';
  const weeks = Math.ceil((total / perMonth) * WEEKS_IN_MONTH);
  const rest = weeks % WEEKS_IN_MONTH;
  const parts = [courseMonthsLabel(Math.floor(weeks / WEEKS_IN_MONTH)), rest ? t('edubridge.course.programWeeks', rest) : ''];
  return parts.filter(Boolean).join(' ');
}
