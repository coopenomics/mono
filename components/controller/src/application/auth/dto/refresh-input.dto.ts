import { Field, InputType } from '@nestjs/graphql';
import { validationMessage } from '@coopenomics/extension-kit';
import { IsNotEmpty } from 'class-validator';

@InputType('RefreshInput')
export class RefreshInputDTO {
  @Field({ description: 'Токен обновления' })
  @IsNotEmpty({ message: validationMessage('auth.refreshInputDto.fieldRefreshTokenRequired') })
  refresh_token!: string;

  @Field({ description: 'Токен доступа' })
  @IsNotEmpty({ message: validationMessage('auth.refreshInputDto.fieldAccessTokenRequired') })
  access_token!: string;
}
