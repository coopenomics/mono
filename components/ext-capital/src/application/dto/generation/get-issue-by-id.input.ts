import { InputType, Field } from '@nestjs/graphql';

/**
 * GraphQL Input DTO для получения задачи по ID
 */
@InputType('GetCapitalIssueByIdInput', {
  description: 'Входные данные для получения задачи по ID',
})
export class GetIssueByIdInputDTO {
  @Field(() => String, {
    description: 'ID задачи для получения',
  })
  id!: string;
}
