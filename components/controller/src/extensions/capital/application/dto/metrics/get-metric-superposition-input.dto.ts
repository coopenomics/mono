import { InputType, Field } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';

@InputType('GetMetricSuperpositionInput')
export class GetMetricSuperpositionInputDTO {
  @Field(() => String, {
    description: 'Хеш проекта или компонента: сводка по своим метрикам и дочерним компонентам',
  })
  @IsNotEmpty()
  @IsString()
  project_hash!: string;
}
