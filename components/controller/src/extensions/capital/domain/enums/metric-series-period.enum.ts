import { registerEnumType } from '@nestjs/graphql';

/**
 * Период агрегации ряда метрики (burn-up / скорость)
 */
export enum MetricSeriesPeriod {
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
}

registerEnumType(MetricSeriesPeriod, {
  name: 'MetricSeriesPeriod',
  description: 'Период агрегации ряда метрики',
});
