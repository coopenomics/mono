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

  @Field(() => Float, {
    description: 'Амплитуда фазора — сила недавнего движения от 0 до 1',
  })
  amplitude!: number;

  @Field(() => Float, {
    description: 'Фаза цикла в радианах: 0 — импульс к цели, π — коррекция',
  })
  phase_rad!: number;
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

  @Field(() => Float, {
    description: 'Средняя амплитуда движения: 0 — покой, выше — есть рост/ход',
  })
  activity!: number;

  @Field(() => Float, {
    description: 'Когерентность фазоров от 0 до 1; в покое равна 1',
  })
  coherence!: number;

  @Field(() => Float, {
    description:
      'Баланс процесса: в покое 1; при росте — согласованность фаз к цели',
  })
  balance!: number;

  @Field(() => Float, {
    description: 'Рост на оси импульса от 0 до 1; в покое 0',
  })
  growth!: number;

  @Field(() => Float, { description: 'Действительная часть суммы фазоров' })
  resultant_re!: number;

  @Field(() => Float, { description: 'Мнимая часть суммы фазоров' })
  resultant_im!: number;

  @Field(() => Float, { description: 'Модуль суммы фазоров' })
  resultant_magnitude!: number;

  @Field(() => Float, { description: 'Угол суммы фазоров в радианах' })
  resultant_angle!: number;

  @Field(() => [MetricSuperpositionItemOutputDTO], {
    description: 'Метрики в резонансе',
  })
  items!: MetricSuperpositionItemOutputDTO[];

  @Field(() => [MetricComponentRollupOutputDTO], {
    description: 'Rollup планов/фактов по дочерним компонентам',
  })
  components!: MetricComponentRollupOutputDTO[];

  @Field(() => String, { description: 'Предупреждение о характере разметки' })
  disclaimer!: string;
}

@ObjectType('CapitalMetricSuperpositionFrame')
export class MetricSuperpositionFrameOutputDTO {
  @Field(() => Date, { description: 'Момент кадра (конец бакета периода)' })
  at!: Date;

  @Field(() => Float, {
    description: 'Средняя амплитуда движения: 0 — покой, выше — есть рост/ход',
  })
  activity!: number;

  @Field(() => Float, {
    description: 'Когерентность фазоров от 0 до 1; в покое равна 1',
  })
  coherence!: number;

  @Field(() => Float, {
    description:
      'Баланс процесса: в покое 1; при росте — согласованность фаз к цели',
  })
  balance!: number;

  @Field(() => Float, {
    description: 'Рост на оси импульса от 0 до 1; в покое 0',
  })
  growth!: number;

  @Field(() => Float, { description: 'Действительная часть суммы фазоров' })
  resultant_re!: number;

  @Field(() => Float, { description: 'Мнимая часть суммы фазоров' })
  resultant_im!: number;

  @Field(() => Float, { description: 'Модуль суммы фазоров' })
  resultant_magnitude!: number;

  @Field(() => Float, { description: 'Угол суммы фазоров в радианах' })
  resultant_angle!: number;

  @Field(() => Float, { description: 'Суммарный факт по охвату на момент кадра' })
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
    description: 'Метрики в резонансе на момент кадра',
  })
  items!: MetricSuperpositionItemOutputDTO[];
}

@ObjectType('CapitalMetricSuperpositionHistory')
export class MetricSuperpositionHistoryOutputDTO {
  @Field(() => String, { description: 'Хеш запрошенного проекта/компонента' })
  project_hash!: string;

  @Field(() => MetricSeriesPeriod, { description: 'Период агрегации' })
  period!: MetricSeriesPeriod;

  @Field(() => Date, { description: 'Начало окна истории' })
  from!: Date;

  @Field(() => Date, { description: 'Конец окна истории' })
  to!: Date;

  @Field(() => [MetricSuperpositionFrameOutputDTO], {
    description: 'Кадры резонанса по бакетам периода',
  })
  frames!: MetricSuperpositionFrameOutputDTO[];
}
