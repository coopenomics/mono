import { ObjectType, Field, Float } from '@nestjs/graphql';
import { MetricContributionSource } from '../../../domain/enums/metric-contribution-source.enum';
import { BaseOutputDTO } from '~/shared/dto/base.dto';

@ObjectType('CapitalMetricContribution', {
  description: 'Запись журнала вкладов в метрику',
})
export class MetricContributionOutputDTO extends BaseOutputDTO {
  @Field(() => String, { description: 'Хеш записи вклада' })
  contribution_hash!: string;

  @Field(() => String, { description: 'Хеш метрики' })
  metric_hash!: string;

  @Field(() => String, { nullable: true, description: 'Хеш задачи, если вклад от задачи' })
  issue_hash?: string | null;

  @Field(() => Float, { description: 'Величина вклада' })
  delta!: number;

  @Field(() => MetricContributionSource, { description: 'Источник вклада' })
  source!: MetricContributionSource;

  @Field(() => String, { description: 'Кто зафиксировал вклад' })
  username!: string;

  @Field(() => Date, { description: 'Момент вклада' })
  occurred_at!: Date;
}
