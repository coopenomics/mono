import { Field, InputType } from '@nestjs/graphql';
import { ReleaseScopeInputDTO } from './release-scope-input.dto';

/**
 * Входные данные `Mutation.approveModeration` (story 9.9).
 *
 * Chairman восхода одобряет заявку на модерацию из стола восхода.
 * Прокидывается на catalog-operator `POST /v1/admin/moderation/:id/approve`,
 * где catalog-operator атомарно переводит заявку в APPROVED и активирует
 * релиз.
 */
@InputType()
export class ApproveModerationInputDTO {
  @Field({ description: 'UUID заявки на модерацию' })
  moderationId!: string;

  @Field(() => ReleaseScopeInputDTO, {
    description: 'Область видимости релиза при активации',
  })
  scope!: ReleaseScopeInputDTO;

  @Field({
    nullable: true,
    description:
      'Явное согласие модератора на одобрение пакета с критической ' +
      'уязвимостью (requires_override=true). Без него — 403.',
  })
  override?: boolean;
}
