import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';

@InputType()
export class RequestEmailVerificationInputDTO {
  @Field(() => String, { description: 'Адрес электронной почты, который подтверждается' })
  @IsEmail({}, { message: 'Укажите корректный адрес электронной почты' })
  email!: string;
}

@InputType()
export class ConfirmEmailVerificationInputDTO {
  @Field(() => String, { description: 'Адрес электронной почты, который подтверждается' })
  @IsEmail({}, { message: 'Укажите корректный адрес электронной почты' })
  email!: string;

  @Field(() => String, { description: 'Код подтверждения из письма (6 цифр)' })
  @IsNotEmpty()
  @IsString()
  @Length(6, 6, { message: 'Код состоит из 6 цифр' })
  code!: string;
}

@ObjectType()
export class EmailVerificationRequestDTO {
  @Field(() => Int, { description: 'Через сколько секунд можно запросить письмо повторно' })
  cooldown_seconds!: number;

  @Field(() => Int, { description: 'Сколько секунд действует код' })
  expires_seconds!: number;
}
