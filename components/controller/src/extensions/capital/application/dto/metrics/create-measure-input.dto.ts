import { InputType, Field } from '@nestjs/graphql';
import { IsNotEmpty, IsString, IsOptional, IsEnum } from 'class-validator';
import { MeasureCatalogTag } from '../../../domain/enums/measure-catalog-tag.enum';
import { MetricSeriesMode } from '../../../domain/enums/metric-series-mode.enum';
import { MetricSeriesPeriod } from '../../../domain/enums/metric-series-period.enum';

@InputType('CreateMeasureInput')
export class CreateMeasureInputDTO {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty()
  @IsString()
  coopname!: string;

  @Field(() => String, { description: 'Название меры' })
  @IsNotEmpty()
  @IsString()
  title!: string;

  @Field(() => String, { description: 'Единица измерения' })
  @IsNotEmpty()
  @IsString()
  unit!: string;

  @Field(() => MetricSeriesMode, {
    nullable: true,
    description: 'Режим ряда; по умолчанию скорость',
    defaultValue: MetricSeriesMode.RATE,
  })
  @IsOptional()
  @IsEnum(MetricSeriesMode)
  series_mode?: MetricSeriesMode;

  @Field(() => MetricSeriesPeriod, {
    nullable: true,
    description: 'Волна: шаг локального анализа; по умолчанию день',
    defaultValue: MetricSeriesPeriod.DAY,
  })
  @IsOptional()
  @IsEnum(MetricSeriesPeriod)
  wave_period?: MetricSeriesPeriod;

  @Field(() => MeasureCatalogTag, {
    nullable: true,
    description: 'Категория меры; по умолчанию продукт',
    defaultValue: MeasureCatalogTag.PRODUCT,
  })
  @IsOptional()
  @IsEnum(MeasureCatalogTag)
  tag?: MeasureCatalogTag;
}
