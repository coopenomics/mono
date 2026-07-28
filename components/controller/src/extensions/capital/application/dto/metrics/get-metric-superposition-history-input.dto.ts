import { InputType, Field } from '@nestjs/graphql';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { MetricSeriesPeriod } from '../../../domain/enums/metric-series-period.enum';

@InputType('GetMetricSuperpositionHistoryInput')
export class GetMetricSuperpositionHistoryInputDTO {
  @Field(() => String, {
    description: 'Хеш проекта или компонента для истории суперпозиции',
  })
  @IsNotEmpty()
  @IsString()
  project_hash!: string;

  @Field(() => MetricSeriesPeriod, {
    description: 'Период агрегации кадров истории',
    defaultValue: MetricSeriesPeriod.WEEK,
  })
  @IsEnum(MetricSeriesPeriod)
  period!: MetricSeriesPeriod;
}
