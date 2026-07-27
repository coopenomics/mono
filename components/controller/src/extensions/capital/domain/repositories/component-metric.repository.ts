import { ComponentMetricDomainEntity } from '../entities/component-metric.entity';
import type { MetricStatus } from '../enums/metric-status.enum';

export interface ComponentMetricRepository {
  create(metric: ComponentMetricDomainEntity): Promise<ComponentMetricDomainEntity>;
  findByMetricHash(metricHash: string): Promise<ComponentMetricDomainEntity | null>;
  findByProjectHash(projectHash: string, status?: MetricStatus): Promise<ComponentMetricDomainEntity[]>;
  update(metric: ComponentMetricDomainEntity): Promise<ComponentMetricDomainEntity>;
}

export const COMPONENT_METRIC_REPOSITORY = Symbol('ComponentMetricRepository');
