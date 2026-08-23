/**
 * @fileoverview DTO publisher-токенов издателей-пайщиков (487-27).
 * Источник — ca-auth `/v1/publisher-tokens` (tenant-JWT кооператива).
 */
import { Field, InputType, ObjectType, registerEnumType } from '@nestjs/graphql';

@ObjectType('AppsCatalogPublisherToken')
export class PublisherTokenDTO {
  @Field({ description: 'UUID токена (им же отзывают)' })
  id!: string;

  @Field({ description: 'Аккаунт пайщика-издателя' })
  username!: string;

  @Field({ description: 'Пакет, на который действует ключ' })
  packageId!: string;

  @Field({ description: 'Метка («CI demo-app»)' })
  label!: string;

  @Field({ description: 'Первые символы токена для узнавания' })
  tokenPrefix!: string;

  @Field({ description: 'Кто выдал' })
  createdBy!: string;

  @Field({ description: 'ISO-дата выдачи' })
  createdAt!: string;

  @Field({ nullable: true, description: 'ISO-дата истечения; null — бессрочно' })
  expiresAt?: string;

  @Field({ nullable: true, description: 'ISO-дата отзыва; null — действует' })
  revokedAt?: string;

  @Field({ nullable: true, description: 'ISO-дата последнего использования' })
  lastUsedAt?: string;
}

export enum CreatePublisherTokenStatus {
  CREATED = 'created',
  FAILED = 'failed',
}

registerEnumType(CreatePublisherTokenStatus, {
  name: 'CreatePublisherTokenStatus',
  description: 'Статус мутации createPublisherToken',
});

@ObjectType()
export class CreatePublisherTokenResultDTO {
  @Field(() => CreatePublisherTokenStatus)
  status!: CreatePublisherTokenStatus;

  @Field({
    nullable: true,
    description: 'Plaintext токена — показывается ОДИН раз, в БД не хранится',
  })
  token?: string;

  @Field(() => PublisherTokenDTO, { nullable: true })
  record?: PublisherTokenDTO;

  @Field({ nullable: true, description: 'Человекочитаемая ошибка' })
  error?: string;
}

@InputType()
export class RevokePublisherTokenInputDTO {
  @Field({ description: 'UUID токена' })
  id!: string;
}
