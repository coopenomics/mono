import { ObjectType, Field } from '@nestjs/graphql';
import { MetricSeriesMode } from '../../../domain/enums/metric-series-mode.enum';
import { MetricStatus } from '../../../domain/enums/metric-status.enum';
import { BaseOutputDTO } from '@coopenomics/extension-kit/sync';

@ObjectType('CapitalMeasure', {
  description: 'Мера кооператива: что измеряем (без целевого значения)',
})
export class MeasureOutputDTO extends BaseOutputDTO {
  @Field(() => String, { description: 'Хеш меры' })
  measure_hash!: string;

  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  coopname!: string;

  @Field(() => String, { description: 'Название меры' })
  title!: string;

  @Field(() => String, { description: 'Единица измерения' })
  unit!: string;

  @Field(() => MetricSeriesMode, { description: 'Режим ряда: скорость или уровень' })
  series_mode!: MetricSeriesMode;

  @Field(() => String, { description: 'Кто создал меру' })
  created_by!: string;

  @Field(() => MetricStatus, { description: 'Статус меры' })
  status!: MetricStatus;
}
