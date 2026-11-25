import { Field, InputType, Int } from '@nestjs/graphql';
import { IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

@InputType('DeclineDecisionInput')
export class DeclineDecisionInputDTO {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsString()
  coopname!: string;

  @Field(() => Int, { description: 'Идентификатор решения' })
  @IsNumber()
  decision_id!: number;

  @Field(() => String, {
    nullable: true,
    description: 'Пояснение председателя к отклонению. Необязательно; хранится на узле кооператива и показывается тем, кого касается решение',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
