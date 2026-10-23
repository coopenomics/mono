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
  @Field({ description: 'Свой пакет, на который выпускается ключ' })
  packageId!: string;

  @Field({ description: 'Метка («CI github/voskhod/demoapp»)' })
  label!: string;

  @Field(() => Int, { nullable: true, description: 'Срок в днях; пусто — бессрочно' })
  expiresInDays?: number;
}
