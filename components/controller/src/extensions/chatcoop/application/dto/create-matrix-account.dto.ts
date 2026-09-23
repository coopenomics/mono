import { Field, InputType } from '@nestjs/graphql';
import { IsString, MinLength, Matches } from 'class-validator';
import { t } from '../../i18n';

@InputType()
export class CreateMatrixAccountInputDTO {
  @Field()
  @IsString()
  @MinLength(3, { message: t('chatcoop.createMatrixAccount.usernameMinLength') })
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: t('chatcoop.createMatrixAccount.usernamePattern'),
  })
  username!: string;

  @Field()
  @IsString()
  @MinLength(6, { message: t('chatcoop.createMatrixAccount.passwordMinLength') })
  password!: string;
}

@InputType()
export class CheckMatrixUsernameInput {
  @Field()
  @IsString()
  @MinLength(3, { message: t('chatcoop.createMatrixAccount.usernameMinLength') })
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: t('chatcoop.createMatrixAccount.usernamePattern'),
  })
  username!: string;
}
