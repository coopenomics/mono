import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import { validationMessage } from '@coopenomics/extension-kit';
import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';

@InputType()
export class RequestEmailVerificationInputDTO {
  @Field(() => String, { description: 'Адрес электронной почты, который подтверждается' })
  @IsEmail({}, { message: validationMessage('auth.emailVerificationDto.invalidEmailMessage') })
  email!: string;
}

@InputType()
export class ConfirmEmailVerificationInputDTO {
  @Field(() => String, { description: 'Адрес электронной почты, который подтверждается' })
  @IsEmail({}, { message: validationMessage('auth.emailVerificationDto.invalidEmailMessage') })
  email!: string;

  @Field(() => String, { description: 'Код подтверждения из письма (6 цифр)' })
  @IsNotEmpty()
  @IsString()
  @Length(6, 6, { message: validationMessage('auth.emailVerificationDto.codeFormatMessage') })
  code!: string;
}

@ObjectType()
export class EmailVerificationRequestDTO {
  @Field(() => Int, { description: 'Через сколько секунд можно запросить письмо повторно' })
  cooldown_seconds!: number;

  @Field(() => Int, { description: 'Сколько секунд действует код' })
  expires_seconds!: number;
}
