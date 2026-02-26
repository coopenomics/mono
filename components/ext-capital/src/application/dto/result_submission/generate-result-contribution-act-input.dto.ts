import { InputType, Field } from '@nestjs/graphql';
import { IsString } from 'class-validator';

@InputType(`ResultContributionActGenerateInput`)
export class ResultContributionActGenerateInputDTO {
  @Field({ description: 'Хэш результата' })
  @IsString()
  result_hash!: string;

  @Field({ description: 'Имя пользователя' })
  @IsString()
  username!: string;
}