import { Field, InputType } from '@nestjs/graphql';
import { IsString } from 'class-validator';
import { t } from '~/i18n';

@InputType('CreateInitialPaymentInput')
export class CreateInitialPaymentInputDTO {
  @Field(() => String, { description: 'Имя аккаунта пользователя' })
  @IsString({ message: t('gateway.createInitialPaymentInput.usernameMustBeString') })
  username!: string;
}
