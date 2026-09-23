import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty } from 'class-validator';
import { t } from '~/i18n';

@InputType('LogoutInput')
export class LogoutInputDTO {
  @Field({ description: 'Токен обновления' })
  @IsNotEmpty({ message: t('auth.logoutInputDto.fieldAccessTokenRequired') })
  access_token!: string;

  @Field({ description: 'Токен доступа' })
  @IsNotEmpty({ message: t('auth.logoutInputDto.fieldRefreshTokenRequired') })
  refresh_token!: string;
}
