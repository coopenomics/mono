import { registerEnumType } from '@nestjs/graphql';

/**
 * Режим построения волнового ряда метрики
 */
export enum MetricSeriesMode {
  /** Волна на скорости (Δ за период) — для монотонных счётчиков */
  RATE = 'rate',
  /** Волна на уровне значения — для регрессирующих метрик */
  LEVEL = 'level',
}

registerEnumType(MetricSeriesMode, {
  name: 'MetricSeriesMode',
  description: 'Режим ряда метрики: скорость или уровень значения',
});
