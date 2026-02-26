import { InputType, Field } from '@nestjs/graphql';
import { IsString } from 'class-validator';

@InputType(`ResultContributionStatementGenerateInput`)
export class ResultContributionStatementGenerateInputDTO {
  @Field({ description: 'Хэш проекта' })
  @IsString()
  project_hash!: string;

  @Field({ description: 'Имя пользователя' })
  @IsString()
  username!: string;
}