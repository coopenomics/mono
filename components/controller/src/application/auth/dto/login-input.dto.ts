import { Field, InputType } from '@nestjs/graphql';
import { validationMessage } from '@coopenomics/extension-kit';
import { IsNotEmpty } from 'class-validator';

@InputType('LoginInput')
export class LoginInputDTO {
  @Field({ description: 'Электронная почта' })
  @IsNotEmpty({ message: validationMessage('auth.loginInputDto.fieldEmailRequired') })
  email!: string;

  @Field({ description: 'Метка времени в строковом формате ISO' })
  @IsNotEmpty({ message: validationMessage('auth.loginInputDto.fieldNowRequired') })
  now!: string;

  @Field({ description: 'Цифровая подпись метки времени' })
  @IsNotEmpty({ message: validationMessage('auth.loginInputDto.fieldSignatureRequired') })
  signature!: string;
}
