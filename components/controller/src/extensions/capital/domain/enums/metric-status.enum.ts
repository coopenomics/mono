import { registerEnumType } from '@nestjs/graphql';

/**
 * Статус метрики компонента
 */
export enum MetricStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
}

registerEnumType(MetricStatus, {
  name: 'MetricStatus',
  description: 'Статус метрики компонента',
});
