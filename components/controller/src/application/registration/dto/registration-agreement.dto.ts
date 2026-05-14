import { ObjectType, Field, Int } from '@nestjs/graphql';
import { IsArray, IsBoolean, IsNumber, IsString } from 'class-validator';
import { AccountType } from '~/application/account/enum/account-type.enum';
import type { IAgreementConfigItem } from '~/domain/registration/config/agreement-config.interface';

/**
 * GraphQL DTO спецификации оферты, требуемой при регистрации.
 *
 * Сливает платформенные оферты (signature/wallet/user/privacy) с
 * extension-зарегистрированными (например, capital → generator_offer,
 * blagorost_offer) — для SignUp на фронте конфигурация неотличима.
 *
 * Не путать с `AgreementDTO` (это уже on-chain подписанное соглашение
 * конкретного пайщика). Здесь — описание чекбокса и его документа,
 * который ещё предстоит сгенерировать и подписать.
 */
@ObjectType('RegistrationAgreement', {
  description: 'Описание оферты, которую пайщик должен принять при регистрации',
})
export class RegistrationAgreementDTO {
  @Field({ description: 'Строковый идентификатор оферты' })
  @IsString()
  id!: string;

  @Field({ description: 'Тип соглашения для on-chain sendAgreement' })
  @IsString()
  agreement_type!: string;

  @Field(() => Int, { description: 'registry_id шаблона на фабрике документов' })
  @IsNumber()
  registry_id!: number;

  @Field({ description: 'Человекочитаемое название оферты' })
  @IsString()
  title!: string;

  @Field({ description: 'Текст для галочки' })
  @IsString()
  checkbox_text!: string;

  @Field({ description: 'Текст ссылки для открытия диалога чтения' })
  @IsString()
  link_text!: string;

  @Field({ description: 'Нужно ли отправлять в блокчейн через sendAgreement' })
  @IsBoolean()
  is_blockchain_agreement!: boolean;

  @Field({ description: 'Нужно ли линковать хеш документа в заявление' })
  @IsBoolean()
  link_to_statement!: boolean;

  @Field(() => [AccountType], {
    description: 'Типы аккаунтов, для которых оферта применима',
  })
  @IsArray()
  applicable_account_types!: AccountType[];

  @Field(() => Int, { description: 'Порядок отображения' })
  @IsNumber()
  order!: number;

  constructor(data?: IAgreementConfigItem) {
    if (data) {
      this.id = data.id;
      this.agreement_type = data.agreement_type;
      this.registry_id = data.registry_id;
      this.title = data.title;
      this.checkbox_text = data.checkbox_text;
      this.link_text = data.link_text;
      this.is_blockchain_agreement = data.is_blockchain_agreement;
      this.link_to_statement = data.link_to_statement;
      this.applicable_account_types = data.applicable_account_types;
      this.order = data.order;
    }
  }
}
