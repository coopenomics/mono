import { InputType, Field } from '@nestjs/graphql';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { MetricSeriesPeriod } from '../../../domain/enums/metric-series-period.enum';

@InputType('GetMetricSuperpositionInput')
export class GetMetricSuperpositionInputDTO {
  @Field(() => String, {
    description: 'Хеш проекта или компонента: сводка по своим метрикам и дочерним компонентам',
  })
  @IsNotEmpty()
  @IsString()
  project_hash!: string;

  @Field(() => MetricSeriesPeriod, {
    description: 'Период агрегации для волновой фазы',
    defaultValue: MetricSeriesPeriod.WEEK,
  })
  @IsEnum(MetricSeriesPeriod)
  period!: MetricSeriesPeriod;
}
