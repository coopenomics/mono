import { ObjectType, Field, Float } from '@nestjs/graphql';
import { BaseOutputDTO } from '@coopenomics/extension-kit/sync';

@ObjectType('CapitalIssueMetricBinding', {
  description: 'Привязка задачи к метрике с плановым вкладом',
})
export class IssueMetricBindingOutputDTO extends BaseOutputDTO {
  @Field(() => String, { description: 'Хеш задачи' })
  issue_hash!: string;

  @Field(() => String, { description: 'Хеш метрики' })
  metric_hash!: string;

  @Field(() => Float, { description: 'Плановый вклад задачи в метрику' })
  delta!: number;
}
