import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty } from 'class-validator';
import { t } from '~/i18n';

@InputType('RefreshInput')
export class RefreshInputDTO {
  @Field({ description: 'Токен обновления' })
  @IsNotEmpty({ message: t('auth.refreshInputDto.fieldRefreshTokenRequired') })
  refresh_token!: string;

  @Field({ description: 'Токен доступа' })
  @IsNotEmpty({ message: t('auth.refreshInputDto.fieldAccessTokenRequired') })
  access_token!: string;
}
