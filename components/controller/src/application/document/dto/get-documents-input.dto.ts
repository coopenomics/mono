import { Field, InputType, Int, registerEnumType } from '@nestjs/graphql';
import GraphQLJSON from 'graphql-type-json';
import { DocumentAction } from '~/domain/document/enums/document-action.enum';

// Регистрируем enum в GraphQL схеме
registerEnumType(DocumentAction, {
  name: 'DocumentAction',
  description: 'Типы действий для документов кооператива',
});

@InputType('GetDocumentsInput')
export class GetDocumentsInputDTO {
  @Field(() => String)
  username!: string;

  @Field(() => GraphQLJSON)
  filter!: Record<string, unknown>;

  @Field(() => Int, { nullable: true })
  limit?: number;

  @Field(() => Int, { nullable: true })
  page?: number;

  @Field(() => String, { nullable: true })
  type?: 'newsubmitted' | 'newresolved';

  @Field(() => Int, { nullable: true })
  after_block?: number;

  @Field(() => Int, { nullable: true })
  before_block?: number;

  /**
   * Массив типов действий для фильтрации первичных документов.
   * Например: [DocumentAction.REGCOOP, DocumentAction.JOINCOOP] - извлечёт только документы с этими действиями.
   * Отбор идёт по действию, которым документ поступил в цепь.
   */
  @Field(() => [DocumentAction], { nullable: true })
  actions?: DocumentAction[];
}
