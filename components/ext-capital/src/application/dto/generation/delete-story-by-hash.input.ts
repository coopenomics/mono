import { InputType, Field } from '@nestjs/graphql';

/**
 * GraphQL Input DTO для удаления истории по хэшу
 */
@InputType('DeleteCapitalStoryByHashInput', {
  description: 'Входные данные для удаления истории по хэшу',
})
export class DeleteStoryByHashInputDTO {
  @Field(() => String, {
    description: 'Хеш истории для удаления',
  })
  story_hash!: string;
}
