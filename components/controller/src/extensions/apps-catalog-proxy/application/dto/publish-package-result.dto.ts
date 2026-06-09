import { Field, ObjectType } from '@nestjs/graphql';

/**
 * Результат `Mutation.publishPackage` (story 9.3.b-pub).
 *
 * Discriminator `status` — `applied` если ca-admin вернул 200 (on-chain
 * `apps::regpkg` улетел и подтверждён), `conflict` если пакет уже
 * зарегистрирован (HTTP 409), `failed` для остальных ошибок (включая
 * degraded-mode когда APPS_CATALOG_API_KEY не задан).
 */
@ObjectType()
export class PublishPackageResultDTO {
  @Field({
    description:
      'Статус: applied (зарегистрирован on-chain), conflict (уже есть), failed (ошибка)',
  })
  status!: 'applied' | 'conflict' | 'failed';

  @Field({
    description:
      'Идентификатор запроса (UUIDv4), который ca-admin использовал для идемпотентности',
  })
  requestId!: string;

  @Field({ nullable: true, description: 'Человекочитаемое сообщение об ошибке' })
  error?: string;
}
