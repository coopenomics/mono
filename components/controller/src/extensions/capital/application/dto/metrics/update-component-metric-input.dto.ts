import { InputType, Field, Float } from '@nestjs/graphql';
import { IsNotEmpty, IsString, IsOptional, IsEnum, IsNumber, IsDate } from 'class-validator';
import { Type } from 'class-transformer';
import { MetricSeriesMode } from '../../../domain/enums/metric-series-mode.enum';

@InputType('UpdateComponentMetricInput')
export class UpdateComponentMetricInputDTO {
  @Field(() => String, { description: 'Хеш цели на компоненте' })
  @IsNotEmpty()
  @IsString()
  metric_hash!: string;

  @Field(() => String, {
    nullable: true,
    description: 'Перепривязка к мере из справочника',
  })
  @IsOptional()
  @IsString()
  measure_hash?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Название меры — перепривязка через поиск/создание меры',
  })
  @IsOptional()
  @IsString()
  title?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Единица измерения — вместе с названием для поиска/создания меры',
  })
  @IsOptional()
  @IsString()
  unit?: string;

  @Field(() => Float, { nullable: true, description: 'Целевое значение' })
  @IsOptional()
  @IsNumber()
  target_value?: number;

  @Field(() => Date, { nullable: true, description: 'Срок достижения цели' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  deadline?: Date | null;

  @Field(() => MetricSeriesMode, {
    nullable: true,
    description: 'Режим ряда при поиске/создании меры по названию',
  })
  @IsOptional()
  @IsEnum(MetricSeriesMode)
  series_mode?: MetricSeriesMode;
}
