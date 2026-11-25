import { Field, InputType, Int, registerEnumType } from '@nestjs/graphql';
import GraphQLJSON from 'graphql-type-json';
import { DocumentAction } from '~/domain/document/enums/document-action.enum';
import { DocumentsView } from '~/domain/document/enums/documents-view.enum';

registerEnumType(DocumentsView, {
  name: 'DocumentsView',
  description: 'Вид выдачи реестра документов: пакеты процессов либо каждый документ отдельно',
});

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

  @Field(() => DocumentsView, {
    nullable: true,
    description: 'Вид выдачи: пакеты процессов (по умолчанию) либо каждый документ отдельно',
  })
  view?: DocumentsView;

  @Field(() => Date, { nullable: true, description: 'Начало периода по дате подписи документа' })
  signed_from?: Date;

  @Field(() => Date, { nullable: true, description: 'Конец периода по дате подписи документа' })
  signed_to?: Date;

  @Field(() => [Int], { nullable: true, description: 'Типы документов — номера шаблонов' })
  registry_ids?: number[];

  @Field(() => String, { nullable: true, description: 'Поиск по названию, тексту и подписантам' })
  search?: string;
}
