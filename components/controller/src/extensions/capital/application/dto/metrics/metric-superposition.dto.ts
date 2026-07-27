import { ObjectType, Field, Float, Int } from '@nestjs/graphql';
import { MetricSeriesMode } from '../../../domain/enums/metric-series-mode.enum';
import { MetricSeriesPeriod } from '../../../domain/enums/metric-series-period.enum';
import { MetricDriveDirection } from '../../../domain/enums/metric-drive-direction.enum';
import { WaveLabel, WavePhase } from '../../../domain/enums/wave-label.enum';

@ObjectType('CapitalMetricSuperpositionItem')
export class MetricSuperpositionItemOutputDTO {
  @Field(() => String, { description: 'Хеш компонента' })
  project_hash!: string;

  @Field(() => String, { description: 'Название компонента' })
  project_title!: string;

  @Field(() => String, { description: 'Хеш метрики' })
  metric_hash!: string;

  @Field(() => String, { description: 'Название метрики' })
  title!: string;

  @Field(() => String, { description: 'Единица измерения' })
  unit!: string;

  @Field(() => Float, { description: 'Факт' })
  fact!: number;

  @Field(() => Float, { description: 'Цель' })
  target_value!: number;

  @Field(() => MetricSeriesMode, { description: 'Режим ряда' })
  series_mode!: MetricSeriesMode;

  @Field(() => WaveLabel, { description: 'Текущая метка волны' })
  current_label!: WaveLabel;

  @Field(() => WavePhase, { description: 'Текущая фаза' })
  current_phase!: WavePhase;

  @Field(() => Float, { description: 'Скорость последнего периода (Δ)' })
  recent_velocity!: number;

  @Field(() => MetricDriveDirection, {
    description: 'Вклад в общую динамику: тянет вверх, вниз или нейтрально',
  })
  drive!: MetricDriveDirection;
}

@ObjectType('CapitalMetricComponentRollup')
export class MetricComponentRollupOutputDTO {
  @Field(() => String, { description: 'Хеш компонента' })
  project_hash!: string;

  @Field(() => String, { description: 'Название компонента' })
  project_title!: string;

  @Field(() => Int, { description: 'Число активных метрик' })
  metrics_count!: number;

  @Field(() => Float, { description: 'Сумма фактов метрик' })
  fact_sum!: number;

  @Field(() => Float, { description: 'Сумма целей метрик' })
  target_sum!: number;
}

@ObjectType('CapitalMetricSuperposition')
export class MetricSuperpositionOutputDTO {
  @Field(() => String, { description: 'Хеш запрошенного проекта/компонента' })
  project_hash!: string;

  @Field(() => MetricSeriesPeriod, { description: 'Период агрегации' })
  period!: MetricSeriesPeriod;

  @Field(() => Float, { description: 'Суммарный факт по охвату' })
  fact_sum!: number;

  @Field(() => Float, { description: 'Суммарная цель по охвату' })
  target_sum!: number;

  @Field(() => Int, { description: 'Сколько метрик тянут вверх' })
  up_count!: number;

  @Field(() => Int, { description: 'Сколько метрик тянут вниз' })
  down_count!: number;

  @Field(() => Int, { description: 'Сколько метрик нейтральны' })
  flat_count!: number;

  @Field(() => [MetricSuperpositionItemOutputDTO], {
    description: 'Метрики в суперпозиции',
  })
  items!: MetricSuperpositionItemOutputDTO[];

  @Field(() => [MetricComponentRollupOutputDTO], {
    description: 'Rollup планов/фактов по дочерним компонентам',
  })
  components!: MetricComponentRollupOutputDTO[];

  @Field(() => String, { description: 'Предупреждение о характере разметки' })
  disclaimer!: string;
}
