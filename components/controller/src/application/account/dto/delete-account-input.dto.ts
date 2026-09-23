import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty } from 'class-validator';
import { t } from '~/i18n';

@InputType('DeleteAccountInput')
export class DeleteAccountInputDTO {
  @Field({ description: 'Имя аккаунта пользователя' })
  @IsNotEmpty({ message: t('account.deleteAccountInput.fieldUsernameForDeleteRequired') })
  username_for_delete!: string;
}
