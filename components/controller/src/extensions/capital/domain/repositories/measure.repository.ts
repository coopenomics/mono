import { MeasureDomainEntity } from '../entities/measure.entity';
import type { MetricStatus } from '../enums/metric-status.enum';

export interface MeasureRepository {
  create(measure: MeasureDomainEntity): Promise<MeasureDomainEntity>;
  findByMeasureHash(measureHash: string): Promise<MeasureDomainEntity | null>;
  findByCoopnameAndTitleUnit(
    coopname: string,
    title: string,
    unit: string,
    status?: MetricStatus
  ): Promise<MeasureDomainEntity | null>;
  findByCoopname(coopname: string, status?: MetricStatus): Promise<MeasureDomainEntity[]>;
  findByMeasureHashes(measureHashes: string[]): Promise<MeasureDomainEntity[]>;
  update(measure: MeasureDomainEntity): Promise<MeasureDomainEntity>;
}

export const MEASURE_REPOSITORY = Symbol('MeasureRepository');
