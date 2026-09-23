import { Field, InputType } from '@nestjs/graphql';
import { validationMessage } from '@coopenomics/extension-kit';
import { IsNotEmpty } from 'class-validator';

@InputType('StartResetKeyInput')
export class StartResetKeyInputDTO {
  @Field({ description: 'Электронная почта' })
  @IsNotEmpty({ message: validationMessage('auth.startResetKeyInputDto.fieldEmailRequired') })
  email!: string;
}
