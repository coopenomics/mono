import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { validationMessage } from '@coopenomics/extension-kit';
import { IsNotEmpty } from 'class-validator';

@InputType('InviteRecipientInput')
export class InviteRecipientInputDTO {
  @Field(() => String, { description: 'Токен приглашения из письма' })
  @IsNotEmpty({ message: validationMessage('auth.resetKeyInputDto.fieldTokenRequired') })
  token!: string;
}

@ObjectType('InviteRecipient')
export class InviteRecipientDTO {
  @Field(() => String, { description: 'Электронная почта приглашённого: по ней он будет входить паролем' })
  email!: string;
}
