import { ObjectType, Field, registerEnumType } from '@nestjs/graphql';
import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import {
  MonoAccountStatusDomainInterface,
  type MonoAccountDomainInterface,
} from '~/domain/account/interfaces/mono-account-domain.interface';

registerEnumType(MonoAccountStatusDomainInterface, {
  name: 'UserStatus',
  description: 'Статус пользователя',
});

@ObjectType('MonoAccount')
export class MonoAccountDTO {
  @Field(() => String, { description: 'Имя пользователя' })
  @IsString()
  public readonly username: string;

  @Field(() => MonoAccountStatusDomainInterface, { description: 'Статус пользователя' })
  @IsEnum(MonoAccountStatusDomainInterface)
  public readonly status: MonoAccountStatusDomainInterface;

  @Field(() => String, { description: 'Сообщение', nullable: true })
  @IsString()
  @IsOptional()
  public readonly message?: string;

  @Field(() => Boolean, { description: 'Зарегистрирован ли пользователь' })
  @IsBoolean()
  public readonly is_registered: boolean;

  @Field(() => Boolean, { description: 'Есть ли у пользователя аккаунт' })
  @IsBoolean()
  public readonly has_account: boolean;

  @Field(() => String, { description: 'Тип пользователя' })
  @IsString()
  public readonly type: 'individual' | 'entrepreneur' | 'organization';

  @Field(() => String, { description: 'Публичный ключ пользователя' })
  @IsString()
  public readonly public_key: string;

  @Field(() => String, { description: 'Реферер пользователя' })
  @IsString()
  public readonly referer: string;

  @Field(() => String, { description: 'Электронная почта пользователя' })
  @IsEmail()
  public readonly email: string;

  @Field(() => String, { description: 'Роль пользователя' })
  @IsString()
  public readonly role: string;

  @Field(() => Boolean, { description: 'Подтверждена ли электронная почта' })
  @IsBoolean()
  public readonly is_email_verified: boolean;

  @Field(() => String, { description: 'ID начального заказа', nullable: true })
  @IsOptional()
  @Type(() => String)
  public readonly initial_order?: string;

  @Field(() => String, { description: 'Идентификатор подписчика для уведомлений' })
  @IsString()
  public readonly subscriber_id: string;

  @Field(() => String, { description: 'Хэш подписчика для уведомлений' })
  @IsString()
  public readonly subscriber_hash: string;

  constructor(user: MonoAccountDomainInterface) {
    this.username = user.username;
    this.status = user.status;
    this.message = user.message;
    this.is_registered = user.is_registered;
    this.has_account = user.has_account;
    this.type = user.type;
    this.public_key = user.public_key;
    this.referer = user.referer;
    this.email = user.email;
    this.role = user.role;
    this.is_email_verified = user.is_email_verified;
    this.initial_order = user.initial_order;
    this.subscriber_id = user.subscriber_id;
    this.subscriber_hash = user.subscriber_hash;
  }
}
