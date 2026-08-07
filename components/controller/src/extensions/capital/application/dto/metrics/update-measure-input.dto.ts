import { InputType, Field } from '@nestjs/graphql';
import { IsNotEmpty, IsString, IsOptional, IsEnum } from 'class-validator';
import { MeasureCatalogTag } from '../../../domain/enums/measure-catalog-tag.enum';
import { MetricSeriesMode } from '../../../domain/enums/metric-series-mode.enum';
import { MetricSeriesPeriod } from '../../../domain/enums/metric-series-period.enum';
import { MetricStatus } from '../../../domain/enums/metric-status.enum';

/**
 * Обновление меры. Состав справочника централизован (миграции).
 * Через API допускается только смена статуса (вкл/выкл).
 */
@InputType('UpdateMeasureInput')
export class UpdateMeasureInputDTO {
  @Field(() => String, { description: 'Хеш меры' })
  @IsNotEmpty()
  @IsString()
  measure_hash!: string;

  @Field(() => MetricStatus, {
    nullable: true,
    description: 'Статус меры: активна или выключена (архив)',
  })
  @IsOptional()
  @IsEnum(MetricStatus)
  status?: MetricStatus;

  @Field(() => String, {
    nullable: true,
    description: 'Не используется: справочник меняется только через миграции',
  })
  @IsOptional()
  @IsString()
  title?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Не используется: справочник меняется только через миграции',
  })
  @IsOptional()
  @IsString()
  unit?: string;

  @Field(() => MetricSeriesMode, {
    nullable: true,
    description: 'Не используется: справочник меняется только через миграции',
  })
  @IsOptional()
  @IsEnum(MetricSeriesMode)
  series_mode?: MetricSeriesMode;

  @Field(() => MetricSeriesPeriod, {
    nullable: true,
    description: 'Не используется: справочник меняется только через миграции',
  })
  @IsOptional()
  @IsEnum(MetricSeriesPeriod)
  wave_period?: MetricSeriesPeriod;

  @Field(() => MeasureCatalogTag, {
    nullable: true,
    description: 'Не используется: справочник меняется только через миграции',
  })
  @IsOptional()
  @IsEnum(MeasureCatalogTag)
  tag?: MeasureCatalogTag;
}
