import { ObjectType, Field, Float } from '@nestjs/graphql';
import { MetricSeriesMode } from '../../../domain/enums/metric-series-mode.enum';
import { MetricSeriesPeriod } from '../../../domain/enums/metric-series-period.enum';
import { MetricSeriesPointOutputDTO } from './metric-series-point.dto';

@ObjectType('CapitalMetricSeries')
export class MetricSeriesOutputDTO {
  @Field(() => String, { description: 'Хеш метрики' })
  metric_hash!: string;

  @Field(() => String, { description: 'Название метрики' })
  title!: string;

  @Field(() => String, { description: 'Единица измерения' })
  unit!: string;

  @Field(() => Float, { description: 'Целевое значение' })
  target_value!: number;

  @Field(() => MetricSeriesMode, { description: 'Режим ряда' })
  series_mode!: MetricSeriesMode;

  @Field(() => MetricSeriesPeriod, { description: 'Период агрегации' })
  period!: MetricSeriesPeriod;

  @Field(() => Float, { description: 'Текущий накопленный факт' })
  fact!: number;

  @Field(() => [MetricSeriesPointOutputDTO], { description: 'Точки ряда' })
  points!: MetricSeriesPointOutputDTO[];
}
