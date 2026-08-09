import { InputType, Field, Float } from '@nestjs/graphql';
import { IsNotEmpty, IsString, IsNumber, IsOptional } from 'class-validator';

@InputType('LogMetricContributionInput')
export class LogMetricContributionInputDTO {
  @Field(() => String, { description: 'Хеш метрики' })
  @IsNotEmpty()
  @IsString()
  metric_hash!: string;

  @Field(() => Float, { description: 'Величина вклада (может быть отрицательной)' })
  @IsNumber()
  delta!: number;

  @Field(() => String, { nullable: true, description: 'Хеш задачи, если вклад связан с задачей' })
  @IsOptional()
  @IsString()
  issue_hash?: string;
}
