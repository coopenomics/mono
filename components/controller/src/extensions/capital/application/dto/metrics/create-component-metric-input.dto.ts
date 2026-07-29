import { InputType, Field, Float } from '@nestjs/graphql';
import { IsNotEmpty, IsString, IsOptional, IsEnum, IsNumber, IsDate } from 'class-validator';
import { Type } from 'class-transformer';
import { MetricSeriesMode } from '../../../domain/enums/metric-series-mode.enum';

/**
 * Создание цели по мере на компоненте.
 * Мера только из централизованного справочника (measure_hash).
 */
@InputType('CreateComponentMetricInput')
export class CreateComponentMetricInputDTO {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty()
  @IsString()
  coopname!: string;

  @Field(() => String, { description: 'Хеш компонента' })
  @IsNotEmpty()
  @IsString()
  project_hash!: string;

  @Field(() => String, {
    description: 'Хеш меры из централизованного справочника',
  })
  @IsNotEmpty()
  @IsString()
  measure_hash!: string;

  @Field(() => String, {
    nullable: true,
    description: 'Не используется: меры только из справочника',
  })
  @IsOptional()
  @IsString()
  title?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Не используется: меры только из справочника',
  })
  @IsOptional()
  @IsString()
  unit?: string;

  @Field(() => Float, { description: 'Целевое значение на компоненте' })
  @IsNumber()
  target_value!: number;

  @Field(() => Date, { nullable: true, description: 'Срок достижения цели' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  deadline?: Date;

  @Field(() => MetricSeriesMode, {
    nullable: true,
    description: 'Не используется: режим ряда задан в справочнике мер',
    defaultValue: MetricSeriesMode.RATE,
  })
  @IsOptional()
  @IsEnum(MetricSeriesMode)
  series_mode?: MetricSeriesMode;
}
