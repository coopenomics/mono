import { InputType, Field } from '@nestjs/graphql';
import { IsNotEmpty, IsString, IsOptional, IsEnum } from 'class-validator';
import { MetricSeriesMode } from '../../../domain/enums/metric-series-mode.enum';

/**
 * Заведение меры в коллекцию кооператива.
 * Название и единица — свободный текст; повтор той же пары возвращает
 * существующую меру, а не плодит дубль.
 */
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
}
