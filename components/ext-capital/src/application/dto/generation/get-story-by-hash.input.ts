import { InputType, Field } from '@nestjs/graphql';

/**
 * GraphQL Input DTO для получения истории по хэшу
 */
@InputType('GetCapitalStoryByHashInput', {
  description: 'Входные данные для получения истории по хэшу',
})
export class GetStoryByHashInputDTO {
  @Field(() => String, {
    description: 'Хеш истории для получения',
  })
  story_hash!: string;
}
