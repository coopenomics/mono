import { InputType, Field } from '@nestjs/graphql';
import { IsString, IsNumber } from 'class-validator';

@InputType(`ResultContributionDecisionGenerateInput`)
export class ResultContributionDecisionGenerateInputDTO {
  @Field({ description: 'Хэш результата' })
  @IsString()
  result_hash!: string;

  @Field({ description: 'ID решения совета' })
  @IsNumber()
  decision_id!: number;

  @Field({ description: 'Имя пользователя' })
  @IsString()
  username!: string;
}