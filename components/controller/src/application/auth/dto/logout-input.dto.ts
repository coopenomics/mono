import { Field, InputType } from '@nestjs/graphql';
import { validationMessage } from '@coopenomics/extension-kit';
import { IsNotEmpty } from 'class-validator';

@InputType('LogoutInput')
export class LogoutInputDTO {
  @Field({ description: 'Токен обновления' })
  @IsNotEmpty({ message: validationMessage('auth.logoutInputDto.fieldAccessTokenRequired') })
  access_token!: string;

  @Field({ description: 'Токен доступа' })
  @IsNotEmpty({ message: validationMessage('auth.logoutInputDto.fieldRefreshTokenRequired') })
  refresh_token!: string;
}
