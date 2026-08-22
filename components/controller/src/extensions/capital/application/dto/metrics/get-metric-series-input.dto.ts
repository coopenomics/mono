import { InputType, Field } from '@nestjs/graphql';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

@InputType('GetMetricSeriesInput')
export class GetMetricSeriesInputDTO {
  @Field(() => String, { description: 'Хеш метрики' })
  @IsNotEmpty()
  @IsString()
  metric_hash!: string;

  @Field(() => Date, {
    nullable: true,
    description: 'Начало окна ряда (включительно). По умолчанию — 30 дней назад',
  })
  @IsOptional()
  from?: Date;

  @Field(() => Date, {
    nullable: true,
    description: 'Конец окна ряда. По умолчанию — сейчас',
  })
  @IsOptional()
  to?: Date;
}
