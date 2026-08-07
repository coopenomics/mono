import { InputType, Field, Int } from '@nestjs/graphql';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';
import { MetricSeriesPeriod } from '../../../domain/enums/metric-series-period.enum';

@InputType('GetMetricWaveInput')
export class GetMetricWaveInputDTO {
  @Field(() => String, { description: 'Хеш метрики' })
  @IsNotEmpty()
  @IsString()
  metric_hash!: string;

  @Field(() => MetricSeriesPeriod, {
    description: 'Период агрегации ряда для разметки',
    defaultValue: MetricSeriesPeriod.WEEK,
  })
  @IsEnum(MetricSeriesPeriod)
  period!: MetricSeriesPeriod;

  @Field(() => Int, {
    nullable: true,
    description: 'Горизонт прогнозного коридора в периодах',
    defaultValue: 8,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(52)
  periods_ahead?: number;
}
