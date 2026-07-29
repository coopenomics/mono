import { ObjectType, Field } from '@nestjs/graphql';
import { MeasureCatalogTag } from '../../../domain/enums/measure-catalog-tag.enum';
import { MetricSeriesMode } from '../../../domain/enums/metric-series-mode.enum';
import { MetricSeriesPeriod } from '../../../domain/enums/metric-series-period.enum';
import { MetricStatus } from '../../../domain/enums/metric-status.enum';
import { BaseOutputDTO } from '~/shared/dto/base.dto';

@ObjectType('CapitalMeasure', {
  description: 'Мера: что измеряем (справочник без целевого значения)',
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

  @Field(() => MetricSeriesPeriod, {
    description: 'Волна: шаг локального анализа импульса и отката',
  })
  wave_period!: MetricSeriesPeriod;

  @Field(() => MeasureCatalogTag, {
    description: 'Категория меры: личное, продукт, контент, кооператив или качество',
  })
  tag!: MeasureCatalogTag;

  @Field(() => String, { description: 'Кто создал меру' })
  created_by!: string;

  @Field(() => MetricStatus, { description: 'Статус меры' })
  status!: MetricStatus;
}
