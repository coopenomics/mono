import { ObjectType, Field, Float } from '@nestjs/graphql';
import { MetricSeriesMode } from '../../../domain/enums/metric-series-mode.enum';
import { MetricStatus } from '../../../domain/enums/metric-status.enum';
import { BaseOutputDTO } from '~/shared/dto/base.dto';

@ObjectType('CapitalComponentMetric', {
  description: 'Нефинансовая метрика компонента',
})
export class ComponentMetricOutputDTO extends BaseOutputDTO {
  @Field(() => String, { description: 'Хеш метрики' })
  metric_hash!: string;

  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  coopname!: string;

  @Field(() => String, { description: 'Хеш компонента' })
  project_hash!: string;

  @Field(() => String, { description: 'Название метрики' })
  title!: string;

  @Field(() => String, { description: 'Единица измерения' })
  unit!: string;

  @Field(() => Float, { description: 'Целевое значение' })
  target_value!: number;

  @Field(() => Date, { nullable: true, description: 'Срок достижения цели' })
  deadline?: Date | null;

  @Field(() => MetricSeriesMode, { description: 'Режим ряда: скорость или уровень' })
  series_mode!: MetricSeriesMode;

  @Field(() => String, { description: 'Кто создал метрику' })
  created_by!: string;

  @Field(() => MetricStatus, { description: 'Статус метрики' })
  status!: MetricStatus;

  @Field(() => Float, { description: 'Фактическое значение (сумма вкладов)' })
  fact!: number;
}
