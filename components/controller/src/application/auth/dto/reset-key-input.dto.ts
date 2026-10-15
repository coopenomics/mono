import { Field, InputType } from '@nestjs/graphql';
import { validationMessage } from '@coopenomics/extension-kit';
import { IsNotEmpty } from 'class-validator';

@InputType('ResetKeyInput')
export class ResetKeyInputDTO {
  @Field({ description: 'Публичный ключ для замены' })
  @IsNotEmpty({ message: validationMessage('auth.resetKeyInputDto.fieldPublicKeyRequired') })
  public_key!: string;

  @Field({ description: 'Токен авторизации для замены ключа, полученный по email' })
  @IsNotEmpty({ message: validationMessage('auth.resetKeyInputDto.fieldTokenRequired') })
  token!: string;
}
