import { InputType, Field } from '@nestjs/graphql';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { MetricSeriesPeriod } from '../../../domain/enums/metric-series-period.enum';

@InputType('GetMetricSeriesInput')
export class GetMetricSeriesInputDTO {
  @Field(() => String, { description: 'Хеш метрики' })
  @IsNotEmpty()
  @IsString()
  metric_hash!: string;

  @Field(() => MetricSeriesPeriod, {
    description: 'Период агрегации ряда',
    defaultValue: MetricSeriesPeriod.WEEK,
  })
  @IsEnum(MetricSeriesPeriod)
  period!: MetricSeriesPeriod;

  @Field(() => Date, {
    nullable: true,
    description: 'Начало окна ряда (включительно). По умолчанию — 12 периодов назад',
  })
  @IsOptional()
  from?: Date;

  @Field(() => Date, {
    nullable: true,
    description: 'Конец окна ряда. По умолчанию — сейчас',
  })
  @IsOptional()
  to?: Date;
}
