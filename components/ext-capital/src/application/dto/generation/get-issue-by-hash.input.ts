import { InputType, Field } from '@nestjs/graphql';

/**
 * GraphQL Input DTO для получения задачи по хэшу
 */
@InputType('GetCapitalIssueByHashInput', {
  description: 'Входные данные для получения задачи по хэшу',
})
export class GetIssueByHashInputDTO {
  @Field(() => String, {
    description: 'Хеш задачи для получения',
  })
  issue_hash!: string;
}
