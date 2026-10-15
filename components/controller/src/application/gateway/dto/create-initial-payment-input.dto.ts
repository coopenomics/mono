import { Field, InputType } from '@nestjs/graphql';
import { validationMessage } from '@coopenomics/extension-kit';
import { IsString } from 'class-validator';

@InputType('CreateInitialPaymentInput')
export class CreateInitialPaymentInputDTO {
  @Field(() => String, { description: 'Имя аккаунта пользователя' })
  @IsString({ message: validationMessage('gateway.createInitialPaymentInput.usernameMustBeString') })
  username!: string;
}
