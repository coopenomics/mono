import { Field, InputType } from '@nestjs/graphql';
import { IsString, IsNumber, ValidateNested } from 'class-validator';
import { GraphQLJSONObject } from 'graphql-type-json';

@InputType('DisputeOnRequestInput')
export class DisputeOnRequestInputDTO {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsString()
  coopname!: string;

  @Field(() => String, { description: 'Имя аккаунта пользователя' })
  @IsString()
  username!: string;

  @Field(() => Number, { description: 'Идентификатор обмена' })
  @IsNumber()
  exchange_id!: number;

  @Field(() => GraphQLJSONObject, { description: 'Документ с аргументами спора' })
  @ValidateNested()
  document!: any;
}
