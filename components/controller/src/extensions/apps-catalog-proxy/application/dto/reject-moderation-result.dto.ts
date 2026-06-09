import { Field, ObjectType, registerEnumType } from '@nestjs/graphql';

/**
 * Статусы результата `Mutation.rejectModeration`.
 *
 *  - `applied` — REJECTED, статус-причина сохранена;
 *  - `conflict` — заявка не в SUBMITTED (HTTP 409);
 *  - `failed` — прочие ошибки.
 */
export enum RejectModerationStatus {
  APPLIED = 'applied',
  CONFLICT = 'conflict',
  FAILED = 'failed',
}

registerEnumType(RejectModerationStatus, {
  name: 'RejectModerationStatus',
  description: 'Статус мутации rejectModeration',
});

@ObjectType()
export class RejectModerationResultDTO {
  @Field(() => RejectModerationStatus, { description: 'Discriminator' })
  status!: RejectModerationStatus;

  @Field({ description: 'UUID запроса' })
  requestId!: string;

  @Field({
    nullable: true,
    description: 'Человекочитаемое сообщение об ошибке',
  })
  error?: string;
}
