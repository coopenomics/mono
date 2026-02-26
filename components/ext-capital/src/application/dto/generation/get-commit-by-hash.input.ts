import { InputType, Field } from '@nestjs/graphql';

/**
 * GraphQL Input DTO для получения коммита по хэшу
 */
@InputType('GetCapitalCommitByHashInput', {
  description: 'Входные данные для получения коммита по хэшу',
})
export class GetCommitByHashInputDTO {
  @Field(() => String, {
    description: 'Хеш коммита для получения',
  })
  commit_hash!: string;
}
