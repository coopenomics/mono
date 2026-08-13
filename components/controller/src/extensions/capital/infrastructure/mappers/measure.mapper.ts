import { MeasureDomainEntity } from '../../domain/entities/measure.entity';
import { MetricSeriesMode } from '../../domain/enums/metric-series-mode.enum';
import { MetricStatus } from '../../domain/enums/metric-status.enum';
import type { IMeasureDatabaseData } from '../../domain/interfaces/measure-database.interface';
import { MeasureTypeormEntity } from '../entities/measure.typeorm-entity';

export class MeasureMapper {
  static toDomain(entity: MeasureTypeormEntity): MeasureDomainEntity {
    const databaseData: IMeasureDatabaseData = {
      _id: entity._id,
      measure_hash: entity.measure_hash,
      coopname: entity.coopname,
      title: entity.title,
      unit: entity.unit,
      series_mode: entity.series_mode ?? MetricSeriesMode.RATE,
      created_by: entity.created_by,
      status: (entity.status as MetricStatus) ?? MetricStatus.ACTIVE,
      block_num: entity.block_num,
      present: entity.present,
      _created_at: entity._created_at,
      _updated_at: entity._updated_at,
    };
    return new MeasureDomainEntity(databaseData);
  }

  static toEntity(domain: MeasureDomainEntity): Partial<MeasureTypeormEntity> {
    return {
      _id: domain._id,
      measure_hash: domain.measure_hash,
      coopname: domain.coopname,
      title: domain.title,
      unit: domain.unit,
      series_mode: domain.series_mode,
      created_by: domain.created_by,
      status: domain.status,
      block_num: domain.block_num,
      present: domain.present,
      _created_at: domain._created_at,
      _updated_at: domain._updated_at,
    };
  }
}
