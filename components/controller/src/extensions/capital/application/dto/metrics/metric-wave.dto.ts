import { ObjectType, Field, Float, Int } from '@nestjs/graphql';
import { MetricSeriesMode } from '../../../domain/enums/metric-series-mode.enum';
import { WaveLabel, WavePhase } from '../../../domain/enums/wave-label.enum';

@ObjectType('CapitalWaveSwing')
export class WaveSwingOutputDTO {
  @Field(() => Int, { description: 'Индекс точки в ряде' })
  index!: number;

  @Field(() => Float, { description: 'Значение на экстремуме' })
  value!: number;

  @Field(() => WaveLabel, { description: 'Метка волны' })
  label!: WaveLabel;
}

@ObjectType('CapitalFibLevel')
export class FibLevelOutputDTO {
  @Field(() => Float, { description: 'Фибо-коэффициент' })
  ratio!: number;

  @Field(() => Float, { description: 'Значение уровня на ряде' })
  value!: number;
}

@ObjectType('CapitalWaveCorridor')
export class WaveCorridorOutputDTO {
  @Field(() => Int, { description: 'Горизонт прогноза в днях' })
  periods_ahead!: number;

  @Field(() => [Float], { description: 'Оптимистичный прогноз ряда' })
  optimistic!: number[];

  @Field(() => [Float], { description: 'Базовый прогноз ряда' })
  base!: number[];

  @Field(() => [Float], { description: 'Пессимистичный прогноз ряда' })
  pessimistic!: number[];

  @Field(() => Int, {
    nullable: true,
    description: 'Оценка периодов до цели (оптимистичный)',
  })
  eta_optimistic_periods!: number | null;

  @Field(() => Int, {
    nullable: true,
    description: 'Оценка периодов до цели (базовый)',
  })
  eta_base_periods!: number | null;

  @Field(() => Int, {
    nullable: true,
    description: 'Оценка периодов до цели (пессимистичный)',
  })
  eta_pessimistic_periods!: number | null;
}

@ObjectType('CapitalMetricWave')
export class MetricWaveOutputDTO {
  @Field(() => String, { description: 'Хеш метрики' })
  metric_hash!: string;

  @Field(() => String, { description: 'Название метрики' })
  title!: string;

  @Field(() => String, { description: 'Единица измерения' })
  unit!: string;

  @Field(() => Float, { description: 'Целевое значение' })
  target_value!: number;

  @Field(() => Float, { description: 'Текущий факт' })
  fact!: number;

  @Field(() => MetricSeriesMode, { description: 'Режим ряда, на котором построена волна' })
  series_mode!: MetricSeriesMode;

  @Field(() => [Float], { description: 'Значения ряда для разметки (скорость или уровень)' })
  values!: number[];

  @Field(() => WaveLabel, { description: 'Текущая метка волны' })
  current_label!: WaveLabel;

  @Field(() => WavePhase, { description: 'Текущая фаза' })
  current_phase!: WavePhase;

  @Field(() => [WaveSwingOutputDTO], { description: 'Свинги с метками' })
  swings!: WaveSwingOutputDTO[];

  @Field(() => [WaveLabel], { description: 'Метка волны на каждой точке ряда' })
  point_labels!: WaveLabel[];

  @Field(() => [FibLevelOutputDTO], { description: 'Фибо-сетка' })
  fib_levels!: FibLevelOutputDTO[];

  @Field(() => WaveCorridorOutputDTO, { description: 'Прогнозный коридор' })
  corridor!: WaveCorridorOutputDTO;

  @Field(() => String, { description: 'Предупреждение о характере разметки' })
  disclaimer!: string;
}
