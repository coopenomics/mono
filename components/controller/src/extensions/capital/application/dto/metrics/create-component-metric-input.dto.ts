import { InputType, Field, Float } from '@nestjs/graphql';
import { IsNotEmpty, IsString, IsOptional, IsEnum, IsNumber, IsDate } from 'class-validator';
import { Type } from 'class-transformer';
import { MetricSeriesMode } from '../../../domain/enums/metric-series-mode.enum';

/**
 * Создание цели по мере на компоненте.
 * Меру задают либо текстом (`title` + `unit` — заводится в коллекции
 * кооператива, если такой ещё нет), либо ссылкой на уже заведённую (`measure_hash`).
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
    nullable: true,
    description: 'Хеш уже заведённой меры кооператива',
  })
  @IsOptional()
  @IsString()
  measure_hash?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Название меры — заводится в коллекции кооператива, если такой ещё нет',
  })
  @IsOptional()
  @IsString()
  title?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Единица измерения — вместе с названием ищет или заводит меру',
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
    description: 'Режим ряда новой меры: скорость (по умолчанию) или уровень',
    defaultValue: MetricSeriesMode.RATE,
  })
  @IsOptional()
  @IsEnum(MetricSeriesMode)
  series_mode?: MetricSeriesMode;
}
