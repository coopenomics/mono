import { registerEnumType } from '@nestjs/graphql';

/**
 * Направление вклада метрики в общую динамику (суперпозиция)
 */
export enum MetricDriveDirection {
  UP = 'UP',
  DOWN = 'DOWN',
  FLAT = 'FLAT',
}

registerEnumType(MetricDriveDirection, {
  name: 'MetricDriveDirection',
  description: 'Направление вклада метрики в общую динамику',
});
