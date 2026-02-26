import { InputType, Field } from '@nestjs/graphql';

/**
 * GraphQL Input DTO для запроса логов по задаче
 */
@InputType('GetCapitalIssueLogsInput', {
  description: 'Входные данные для получения логов событий по задаче',
})
export class GetIssueLogsInputDTO {
  @Field(() => String, {
    description: 'Хеш задачи',
  })
  issue_hash!: string;
}
