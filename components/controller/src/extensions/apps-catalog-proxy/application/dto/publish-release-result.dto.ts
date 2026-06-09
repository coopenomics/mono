import { Field, ObjectType, registerEnumType } from '@nestjs/graphql';

/**
 * Статусы результата `Mutation.publishRelease` (story 9.3.b-rel).
 *
 *  - `applied` — ca-admin вернул 200, on-chain `apps::setrelease` улетел;
 *  - `invalidManifest` — HTTP 422 INVALID_MANIFEST (Zod-валидация
 *    manifest'а провалилась на стороне ca-admin); UI должен показать
 *    `error` как валидационное сообщение;
 *  - `failed` — прочие ошибки (network, 401, degraded-mode без
 *    APPS_CATALOG_API_KEY).
 */
export enum PublishReleaseStatus {
  APPLIED = 'applied',
  INVALID_MANIFEST = 'invalidManifest',
  FAILED = 'failed',
}

registerEnumType(PublishReleaseStatus, {
  name: 'PublishReleaseStatus',
  description: 'Статус мутации publishRelease',
});

@ObjectType()
export class PublishReleaseResultDTO {
  @Field(() => PublishReleaseStatus, { description: 'Discriminator' })
  status!: PublishReleaseStatus;

  @Field({
    description:
      'Идентификатор запроса (UUIDv4), который ca-admin использовал для идемпотентности',
  })
  requestId!: string;

  @Field({
    nullable: true,
    description:
      'Идентификатор blockchain-транзакции (если ca-admin её вернул)',
  })
  transactionId?: string;

  @Field({
    nullable: true,
    description: 'Человекочитаемое сообщение об ошибке',
  })
  error?: string;
}
