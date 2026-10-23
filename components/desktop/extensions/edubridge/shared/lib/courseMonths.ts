import { t } from '../../i18n';

/** Недель в месяце программы: месяц — четыре недели. */
const WEEKS_IN_MONTH = 4;

/**
 * Длительность словами: «9 месяцев», «3 месяца 2 недели», «2 недели». Месяцы
 * приходят с шагом в неделю (0,25); пусто у курса без конечной программы.
 */
export function courseMonthsLabel(months: number | null | undefined): string {
  const weeks = Math.round(Number(months ?? 0) * WEEKS_IN_MONTH);
  if (!(weeks > 0)) return '';
  const whole = Math.floor(weeks / WEEKS_IN_MONTH);
  const rest = weeks % WEEKS_IN_MONTH;
  return [whole > 0 ? t('datetime.relative.months', whole) : '', rest > 0 ? t('edubridge.duration.weeks', rest) : ''].filter(Boolean).join(' ');
}

/**
 * Длительность для плитки: целые месяцы — словами («9 месяцев»), с неделями —
 * коротко («3 мес. 2 нед.»), чтобы значение помещалось в плитку.
 */
export function programSpanCompact(programMonths: unknown): string {
  const weeks = Math.round(Number(programMonths || 0) * WEEKS_IN_MONTH);
  const whole = Math.floor(weeks / WEEKS_IN_MONTH);
  const rest = weeks % WEEKS_IN_MONTH;
  if (!(weeks > 0) || rest === 0) return courseMonthsLabel(Number(programMonths || 0));
  return [whole > 0 ? t('edubridge.duration.monthsShort', { n: whole }) : '', t('edubridge.duration.weeksShort', { n: rest })].filter(Boolean).join(' ');
}

/** Длительность программы словами по месяцам программы; пусто у программы без конца. */
export function programSpanLabel(programMonths: unknown): string {
  return courseMonthsLabel(Number(programMonths || 0));
}
