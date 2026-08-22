import { Field, InputType, Int } from '@nestjs/graphql';
import { IsNumber, IsString } from 'class-validator';

@InputType('DeclineDecisionInput')
export class DeclineDecisionInputDTO {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsString()
  coopname!: string;

  @Field(() => Int, { description: 'Идентификатор решения' })
  @IsNumber()
  decision_id!: number;
}
