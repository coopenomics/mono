/** @fileoverview DTO назначений издателей (487-27). */
import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';

@ObjectType('AppsPublisher')
export class AppsPublisherDTO {
  @Field({ description: 'Пайщик-издатель' })
  username!: string;

  @Field({ description: 'Пакет каталога @coopname/name' })
  packageId!: string;

  @Field({ description: 'Кто назначил' })
  addedBy!: string;

  @Field({ description: 'ISO-дата назначения' })
  createdAt!: string;
}

@InputType()
export class AppsPublisherAssignmentInputDTO {
  @Field({ description: 'Аккаунт пайщика (eosio::name)' })
  username!: string;

  @Field({ description: 'Пакет @coopname/name' })
  packageId!: string;
}

@InputType()
export class IssueMyPublisherTokenInputDTO {
  @Field(() => [String], {
    defaultValue: [],
    description: 'Свои пакеты, на которые выпускается ключ. Пусто при ключе на все пакеты',
  })
  packageIds!: string[];

  @Field(() => Boolean, {
    defaultValue: false,
    description: 'Ключ на все свои пакеты, включая будущие',
  })
  allPackages!: boolean;

  @Field({ description: 'Название ключа («Ноутбук», «Сборка на сервере»)' })
  label!: string;

  @Field(() => Int, { nullable: true, description: 'Срок в днях; пусто — бессрочно' })
  expiresInDays?: number;
}
