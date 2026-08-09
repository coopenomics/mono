import type { MetricSeriesMode } from '../enums/metric-series-mode.enum';
import type { MetricSeriesPeriod } from '../enums/metric-series-period.enum';
import type { MeasureCatalogTag } from '../enums/measure-catalog-tag.enum';
import type { MetricStatus } from '../enums/metric-status.enum';
import type { IBaseDatabaseData } from '@coopenomics/extension-kit/sync';

/**
 * Справочник меры: что измеряем (без целевого значения).
 */
export interface IMeasureDatabaseData extends IBaseDatabaseData {
  measure_hash: string;
  coopname: string;
  title: string;
  unit: string;
  series_mode: MetricSeriesMode;
  /** Шаг локальной волны (не норма «N за период») */
  wave_period: MetricSeriesPeriod;
  /** Категория справочника (личное / продукт / …) */
  tag: MeasureCatalogTag;
  created_by: string;
  status: MetricStatus;
}
