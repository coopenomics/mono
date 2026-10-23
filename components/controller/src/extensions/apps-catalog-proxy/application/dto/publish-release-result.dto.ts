import { Field, ObjectType, registerEnumType } from '@nestjs/graphql';

/**
 * Статусы результата `Mutation.publishRelease` (story 9.3.b-rel).
 *
 *  - `applied` — catalog-operator вернул 200, выпуск записан в базе каталога;
 *  - `invalidManifest` — HTTP 422 INVALID_MANIFEST (Zod-валидация
 *    manifest'а провалилась на стороне catalog-operator); UI должен показать
 *    `error` как валидационное сообщение;
 *  - `failed` — прочие ошибки (network, 401, degraded-mode без
 *    APPS_CATALOG_OPERATOR_API_KEY).
 */
export enum PublishReleaseStatus {
  /** Пакет доверенный — релиз активирован сразу. */
  APPLIED = 'applied',
  /** Первый релиз пакета — ждёт модератора (487-27). */
  QUEUED = 'queued',
  /** Версии нет в реестре — сначала `npm publish`. */
  NOT_PUBLISHED = 'notPublished',
  /** Версия уже подана/выпущена. */
  CONFLICT = 'conflict',
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
      'Идентификатор запроса (UUIDv4), который catalog-operator использовал для идемпотентности',
  })
  requestId!: string;

  @Field({
    nullable: true,
    description: 'Устарело: выпуск записывает catalog-operator при одобрении',
  })
  transactionId?: string;

  @Field({
    nullable: true,
    description: 'Идентификатор заявки на модерацию (487-27)',
  })
  moderationId?: string;

  @Field({
    nullable: true,
    description: 'Человекочитаемое сообщение об ошибке',
  })
  error?: string;
}
