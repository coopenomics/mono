import { InputType, Field, Float } from '@nestjs/graphql';
import { IsNotEmpty, IsString, IsOptional, IsEnum, IsNumber, IsDate } from 'class-validator';
import { Type } from 'class-transformer';
import { MetricSeriesMode } from '../../../domain/enums/metric-series-mode.enum';

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

  @Field(() => String, { description: 'Название метрики' })
  @IsNotEmpty()
  @IsString()
  title!: string;

  @Field(() => String, { description: 'Единица измерения' })
  @IsNotEmpty()
  @IsString()
  unit!: string;

  @Field(() => Float, { description: 'Целевое значение' })
  @IsNumber()
  target_value!: number;

  @Field(() => Date, { nullable: true, description: 'Срок достижения цели' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  deadline?: Date;

  @Field(() => MetricSeriesMode, {
    nullable: true,
    description: 'Режим ряда; по умолчанию скорость',
    defaultValue: MetricSeriesMode.RATE,
  })
  @IsOptional()
  @IsEnum(MetricSeriesMode)
  series_mode?: MetricSeriesMode;
}
