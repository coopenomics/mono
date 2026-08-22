import { InputType, Field } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';

@InputType('GetMetricWaveInput')
export class GetMetricWaveInputDTO {
  @Field(() => String, { description: 'Хеш метрики' })
  @IsNotEmpty()
  @IsString()
  metric_hash!: string;
}
