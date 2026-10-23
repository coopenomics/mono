import { Field, ObjectType, registerEnumType } from '@nestjs/graphql';

/**
 * Статусы результата `Mutation.publishPackage` (story 9.3.b-pub).
 *
 *  - `applied` — ca-admin вернул 200 (on-chain `apps::regpkg` улетел
 *    и подтверждён);
 *  - `conflict` — пакет уже зарегистрирован (HTTP 409);
 *  - `failed` — прочие ошибки (включая degraded-mode, когда
 *    APPS_CATALOG_API_KEY не задан).
 */
export enum PublishPackageStatus {
  APPLIED = 'applied',
  CONFLICT = 'conflict',
  FAILED = 'failed',
}

registerEnumType(PublishPackageStatus, {
  name: 'PublishPackageStatus',
  description: 'Статус мутации publishPackage',
});

@ObjectType()
export class PublishPackageResultDTO {
  @Field(() => PublishPackageStatus, { description: 'Discriminator' })
  status!: PublishPackageStatus;

  @Field({
    description:
      'Идентификатор запроса (UUIDv4), который ca-admin использовал для идемпотентности',
  })
  requestId!: string;

  @Field({ nullable: true, description: 'Человекочитаемое сообщение об ошибке' })
  error?: string;
}
