import { InputType, Field } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';

@InputType('GetMetricSuperpositionHistoryInput')
export class GetMetricSuperpositionHistoryInputDTO {
  @Field(() => String, {
    description: 'Хеш проекта или компонента для истории резонанса',
  })
  @IsNotEmpty()
  @IsString()
  project_hash!: string;
}
