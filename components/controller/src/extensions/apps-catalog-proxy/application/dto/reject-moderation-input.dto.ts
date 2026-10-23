import { Field, InputType } from '@nestjs/graphql';

/**
 * Входные данные `Mutation.rejectModeration` (story 9.9).
 *
 * Chairman восхода отклоняет заявку на модерацию с причиной. Причина
 * пишется в `status_reason` и доставляется разработчику через outbox.
 */
@InputType()
export class RejectModerationInputDTO {
  @Field({ description: 'UUID заявки на модерацию' })
  moderationId!: string;

  @Field({
    description: 'Причина отказа (3..2000 символов), увидит разработчик',
  })
  reason!: string;
}
