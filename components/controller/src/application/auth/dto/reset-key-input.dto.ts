import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty } from 'class-validator';
import { t } from '~/i18n';

@InputType('ResetKeyInput')
export class ResetKeyInputDTO {
  @Field({ description: 'Публичный ключ для замены' })
  @IsNotEmpty({ message: t('auth.resetKeyInputDto.fieldPublicKeyRequired') })
  public_key!: string;

  @Field({ description: 'Токен авторизации для замены ключа, полученный по email' })
  @IsNotEmpty({ message: t('auth.resetKeyInputDto.fieldTokenRequired') })
  token!: string;
}
