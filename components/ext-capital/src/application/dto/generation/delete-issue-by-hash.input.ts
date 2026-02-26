import { InputType, Field } from '@nestjs/graphql';

/**
 * GraphQL Input DTO для удаления задачи по хэшу
 */
@InputType('DeleteCapitalIssueByHashInput', {
  description: 'Входные данные для удаления задачи по хэшу',
})
export class DeleteIssueByHashInputDTO {
  @Field(() => String, {
    description: 'Хеш задачи для удаления',
  })
  issue_hash!: string;
}
