import { Field, ObjectType, registerEnumType } from '@nestjs/graphql';

/**
 * Статусы результата `Mutation.approveModeration`.
 *
 *  - `applied` — release ACTIVE, on-chain `apps::setrelease` прошёл;
 *  - `pendingChain` — moderation одобрена, но on-chain провалился
 *    (HTTP 423); recovery worker повторит позже;
 *  - `conflict` — заявка не в SUBMITTED (HTTP 409);
 *  - `requiresOverride` — нужен явный override:true (HTTP 403);
 *  - `failed` — прочие ошибки.
 */
export enum ApproveModerationStatus {
  APPLIED = 'applied',
  PENDING_CHAIN = 'pendingChain',
  CONFLICT = 'conflict',
  REQUIRES_OVERRIDE = 'requiresOverride',
  FAILED = 'failed',
}

registerEnumType(ApproveModerationStatus, {
  name: 'ApproveModerationStatus',
  description: 'Статус мутации approveModeration',
});

@ObjectType()
export class ApproveModerationResultDTO {
  @Field(() => ApproveModerationStatus, { description: 'Discriminator' })
  status!: ApproveModerationStatus;

  @Field({ description: 'UUID запроса (для логов / идемпотентности)' })
  requestId!: string;

  @Field({
    nullable: true,
    description: 'Идентификатор пакета (только при status=applied)',
  })
  packageId?: string;

  @Field({
    nullable: true,
    description: 'Версия активированного релиза (только при status=applied)',
  })
  version?: string;

  @Field({
    nullable: true,
    description: 'Человекочитаемое сообщение об ошибке',
  })
  error?: string;
}
