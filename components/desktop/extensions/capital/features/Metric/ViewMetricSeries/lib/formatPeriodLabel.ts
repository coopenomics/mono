import { Zeus } from '@coopenomics/sdk';

/** Короткая подпись периода на оси X. */
export function formatPeriodLabel(
  iso: string | Date,
  period: Zeus.ModelTypes['MetricSeriesPeriod'],
): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '';

  const pad = (n: number) => String(n).padStart(2, '0');
  const hhmm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const ddmm = `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`;

  switch (period) {
    case Zeus.MetricSeriesPeriod.MINUTE:
    case Zeus.MetricSeriesPeriod.MINUTE_5:
    case Zeus.MetricSeriesPeriod.MINUTE_15:
    case Zeus.MetricSeriesPeriod.HOUR:
      return hhmm;
    case Zeus.MetricSeriesPeriod.DAY:
    case Zeus.MetricSeriesPeriod.WEEK:
      return ddmm;
    case Zeus.MetricSeriesPeriod.MONTH:
      return `${pad(d.getMonth() + 1)}.${String(d.getFullYear()).slice(2)}`;
    default:
      return ddmm;
  }
}
