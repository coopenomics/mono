import { MetricSeriesMode } from '../../domain/enums/metric-series-mode.enum';
import { MetricStatus } from '../../domain/enums/metric-status.enum';
import { ChainRecord } from '@coopenomics/extension-kit/sync';

export const MeasureEntityName = 'capital_measures';

export class MeasureRecord extends ChainRecord {
  measure_hash!: string;

  coopname!: string;

  title!: string;

  unit!: string;

  series_mode!: MetricSeriesMode;

  created_by!: string;

  declare status: MetricStatus;
}
