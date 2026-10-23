import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';

@InputType('CapitalShareTransferStateInput')
export class ShareTransferStateInputDTO {
  @Field(() => String, { description: 'Пайщик, чей остаток показать' })
  @IsString()
  @IsNotEmpty()
  username!: string;
}

/** Что пайщик может транслировать прямо сейчас. */
@ObjectType('CapitalShareTransferState', { description: 'Паевой взнос пайщика в Благоросте, доступный для трансляции' })
export class ShareTransferStateDTO {
  @Field(() => String, { description: 'Пайщик' })
  username!: string;

  @Field(() => String, { description: 'Остаток паевого взноса на кошельке Благороста, с валютой' })
  blagorost_balance!: string;
}
