import { Field, InputType } from '@nestjs/graphql';
import { validationMessage } from '@coopenomics/extension-kit';
import { IsString, MinLength, Matches } from 'class-validator';

@InputType()
export class CreateMatrixAccountInputDTO {
  @Field()
  @IsString()
  @MinLength(3, { message: validationMessage('chatcoop.createMatrixAccount.usernameMinLength') })
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: validationMessage('chatcoop.createMatrixAccount.usernamePattern'),
  })
  username!: string;

  @Field()
  @IsString()
  @MinLength(6, { message: validationMessage('chatcoop.createMatrixAccount.passwordMinLength') })
  password!: string;
}

@InputType()
export class CheckMatrixUsernameInput {
  @Field()
  @IsString()
  @MinLength(3, { message: validationMessage('chatcoop.createMatrixAccount.usernameMinLength') })
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: validationMessage('chatcoop.createMatrixAccount.usernamePattern'),
  })
  username!: string;
}
