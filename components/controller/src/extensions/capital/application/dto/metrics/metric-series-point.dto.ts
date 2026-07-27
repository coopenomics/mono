import { ObjectType, Field, Float } from '@nestjs/graphql';

@ObjectType('CapitalMetricSeriesPoint')
export class MetricSeriesPointOutputDTO {
  @Field(() => Date, { description: 'Начало периода (UTC)' })
  period_start!: Date;

  @Field(() => Date, { description: 'Конец периода, не включая (UTC)' })
  period_end!: Date;

  @Field(() => Float, { description: 'Сумма вкладов за период (скорость)' })
  delta!: number;

  @Field(() => Float, { description: 'Накопленный факт на конец периода' })
  cumulative!: number;

  @Field(() => Float, {
    nullable: true,
    description: 'Идеальная линия burn-up к дедлайну на конец периода',
  })
  ideal_cumulative!: number | null;
}
