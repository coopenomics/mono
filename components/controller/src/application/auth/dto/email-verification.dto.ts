import { Field, InputType, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import { validationMessage } from '@coopenomics/extension-kit';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';
import { EmailVerificationPurpose } from '../email-verification/email-verification-purpose.enum';

registerEnumType(EmailVerificationPurpose, {
  name: 'EmailVerificationPurpose',
  description: 'Зачем запрашивается код подтверждения почты',
});

@InputType()
export class RequestEmailVerificationInputDTO {
  @Field(() => String, { description: 'Адрес электронной почты, который подтверждается' })
  @IsEmail({}, { message: validationMessage('auth.emailVerificationDto.invalidEmailMessage') })
  email!: string;

  @Field(() => EmailVerificationPurpose, {
    nullable: true,
    description:
      'Зачем нужен код: при регистрации на уже зарегистрированный адрес код не отправляется. По умолчанию — подтверждение из кабинета',
  })
  @IsOptional()
  @IsEnum(EmailVerificationPurpose)
  purpose?: EmailVerificationPurpose;
}

@InputType()
export class EmailRegistrationCheckInputDTO {
  @Field(() => String, { description: 'Адрес электронной почты, который проверяется' })
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
