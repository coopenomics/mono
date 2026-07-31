import { InputType, Field } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';

@InputType('GetMetricContributionsInput')
export class GetMetricContributionsInputDTO {
  @Field(() => String, { description: 'Хеш метрики' })
  @IsNotEmpty()
  @IsString()
  metric_hash!: string;
}
