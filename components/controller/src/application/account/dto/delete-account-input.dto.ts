import { Field, InputType } from '@nestjs/graphql';
import { validationMessage } from '@coopenomics/extension-kit';
import { IsNotEmpty } from 'class-validator';

@InputType('DeleteAccountInput')
export class DeleteAccountInputDTO {
  @Field({ description: 'Имя аккаунта пользователя' })
  @IsNotEmpty({ message: validationMessage('account.deleteAccountInput.fieldUsernameForDeleteRequired') })
  username_for_delete!: string;
}
