import { pluralize } from 'src/shared/lib/utils';

/** «9 месяцев» — длительность курса словами; пусто у курса без конечной программы. */
export function courseMonthsLabel(months: number | null | undefined): string {
  const n = Number(months ?? 0);
  return n > 0 ? `${n} ${pluralize(n, ['месяц', 'месяца', 'месяцев'])}` : '';
}
