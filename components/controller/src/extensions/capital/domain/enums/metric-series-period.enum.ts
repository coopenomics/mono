import { registerEnumType } from '@nestjs/graphql';

/**
 * Период агрегации ряда метрики (накопление / скорость / волна).
 * Мелкие таймфреймы — как на биржевых графиках: 1 / 5 / 15 минут, час…
 */
export enum MetricSeriesPeriod {
  MINUTE = 'minute',
  MINUTE_5 = 'minute_5',
  MINUTE_15 = 'minute_15',
  HOUR = 'hour',
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
}

registerEnumType(MetricSeriesPeriod, {
  name: 'MetricSeriesPeriod',
  description: 'Период агрегации ряда метрики',
});
