import { ObjectType, Field, Float } from '@nestjs/graphql';
import { MetricSeriesMode } from '../../../domain/enums/metric-series-mode.enum';
import { MetricStatus } from '../../../domain/enums/metric-status.enum';
import { BaseOutputDTO } from '~/shared/dto/base.dto';

@ObjectType('CapitalComponentMetric', {
  description: 'Цель по мере на компоненте (инстанс меры с целевым значением)',
})
export class ComponentMetricOutputDTO extends BaseOutputDTO {
  @Field(() => String, { description: 'Хеш цели на компоненте' })
  metric_hash!: string;

  @Field(() => String, { description: 'Хеш меры из справочника' })
  measure_hash!: string;

  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  coopname!: string;

  @Field(() => String, { description: 'Хеш компонента' })
  project_hash!: string;

  @Field(() => String, { description: 'Название меры' })
  title!: string;

  @Field(() => String, { description: 'Единица измерения' })
  unit!: string;

  @Field(() => Float, { description: 'Целевое значение на компоненте' })
  target_value!: number;

  @Field(() => Date, { nullable: true, description: 'Срок достижения цели' })
  deadline?: Date | null;

  @Field(() => MetricSeriesMode, { description: 'Режим ряда меры' })
  series_mode!: MetricSeriesMode;

  @Field(() => String, { description: 'Кто создал цель' })
  created_by!: string;

  @Field(() => MetricStatus, { description: 'Статус цели' })
  status!: MetricStatus;

  @Field(() => Float, { description: 'Фактическое значение (сумма вкладов)' })
  fact!: number;
}
