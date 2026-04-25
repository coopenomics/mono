import { Field, InputType } from '@nestjs/graphql';
import { IsString, IsNumber } from 'class-validator';

@InputType('PublishRequestInput')
export class PublishRequestInputDTO {
  @Field({ description: 'Имя аккаунта кооператива' })
  @IsString()
  coopname!: string;

  @Field(() => String, { description: 'Имя аккаунта пользователя' })
  @IsString()
  username!: string;

  @Field(() => Number, { description: 'Идентификатор заявки' })
  @IsNumber()
  exchange_id!: number;
}
