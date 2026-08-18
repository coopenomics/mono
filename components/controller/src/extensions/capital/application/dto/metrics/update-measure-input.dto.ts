import { InputType, Field } from '@nestjs/graphql';
import { IsNotEmpty, IsString, IsOptional, IsEnum } from 'class-validator';
import { MetricSeriesMode } from '../../../domain/enums/metric-series-mode.enum';
import { MetricStatus } from '../../../domain/enums/metric-status.enum';

/**
 * Правка меры своего кооператива: название, единица, режим ряда, статус.
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

  @Field(() => String, { nullable: true, description: 'Название меры' })
  @IsOptional()
  @IsString()
  title?: string;

  @Field(() => String, { nullable: true, description: 'Единица измерения' })
  @IsOptional()
  @IsString()
  unit?: string;

  @Field(() => MetricSeriesMode, {
    nullable: true,
    description: 'Режим ряда: скорость или уровень',
  })
  @IsOptional()
  @IsEnum(MetricSeriesMode)
  series_mode?: MetricSeriesMode;
}
