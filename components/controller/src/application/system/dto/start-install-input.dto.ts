import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';
import { t } from '~/i18n';

@InputType('StartInstallInput')
export class StartInstallInputDTO {
  @Field(() => String, { description: 'Приватный ключ кооператива' })
  @IsNotEmpty({ message: t('system.startInstallInput.wifRequired') })
  @IsString()
  wif!: string;
}
