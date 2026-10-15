import { MetricStatus } from '../../domain/enums/metric-status.enum';
import { ChainRecord } from '@coopenomics/extension-kit/sync';

export const ComponentMetricEntityName = 'capital_component_metrics';

export class ComponentMetricRecord extends ChainRecord {
  metric_hash!: string;

  measure_hash!: string;

  coopname!: string;

  project_hash!: string;

  target_value!: number;

  deadline?: Date | null;

  created_by!: string;

  declare status: MetricStatus;
}
