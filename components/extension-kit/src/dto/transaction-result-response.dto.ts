import { Field, ObjectType } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-type-json';

/**
 * DTO для результата транзакции.
 */
@ObjectType('Transaction')
export class TransactionDTO {
  @Field(() => GraphQLJSON, { description: 'Блокчейн, который использовался', nullable: true })
  chain?: any;

  @Field(() => GraphQLJSON, { description: 'Запрос на подписание транзакции', nullable: true })
  request?: any;

  @Field(() => GraphQLJSON, { description: 'Разрешенный запрос на подписание транзакции', nullable: true })
  resolved?: any;

  @Field(() => GraphQLJSON, {
    description: 'Ответ от API после отправки транзакции (если был выполнен бродкаст)',
    nullable: true,
  })
  response?: any;

  @Field(() => GraphQLJSON, { description: 'Возвращаемые значения после выполнения транзакции', nullable: true })
  returns?: any;

  @Field(() => GraphQLJSON, { description: 'Ревизии транзакции, измененные расширениями в ESR формате', nullable: true })
  revisions?: any;

  @Field(() => GraphQLJSON, { description: 'Подписи транзакции', nullable: true })
  signatures?: any;

  @Field(() => GraphQLJSON, { description: 'Авторизованный подписант', nullable: true })
  signer?: any;

  @Field(() => GraphQLJSON, { description: 'Итоговая транзакция', nullable: true })
  transaction?: any;
}
