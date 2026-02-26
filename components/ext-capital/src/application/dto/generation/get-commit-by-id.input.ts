import { InputType, Field } from '@nestjs/graphql';

/**
 * GraphQL Input DTO для получения коммита по ID
 */
@InputType('GetCapitalCommitByIdInput', {
  description: 'Входные данные для получения коммита по ID',
})
export class GetCommitByIdInputDTO {
  @Field(() => String, {
    description: 'ID коммита для получения',
  })
  id!: string;
}
