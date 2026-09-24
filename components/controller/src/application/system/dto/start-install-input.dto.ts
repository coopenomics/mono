import { Field, InputType } from '@nestjs/graphql';
import { validationMessage } from '@coopenomics/extension-kit';
import { IsNotEmpty, IsString } from 'class-validator';

@InputType('StartInstallInput')
export class StartInstallInputDTO {
  @Field(() => String, { description: 'Приватный ключ кооператива' })
  @IsNotEmpty({ message: validationMessage('system.startInstallInput.wifRequired') })
  @IsString()
  wif!: string;
}
