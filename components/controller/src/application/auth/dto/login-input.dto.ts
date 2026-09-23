import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty } from 'class-validator';
import { t } from '~/i18n';

@InputType('LoginInput')
export class LoginInputDTO {
  @Field({ description: 'Электронная почта' })
  @IsNotEmpty({ message: t('auth.loginInputDto.fieldEmailRequired') })
  email!: string;

  @Field({ description: 'Метка времени в строковом формате ISO' })
  @IsNotEmpty({ message: t('auth.loginInputDto.fieldNowRequired') })
  now!: string;

  @Field({ description: 'Цифровая подпись метки времени' })
  @IsNotEmpty({ message: t('auth.loginInputDto.fieldSignatureRequired') })
  signature!: string;
}
