import { Field, Int, ObjectType, registerEnumType } from '@nestjs/graphql';

/** Какую редакцию документа показать: утверждённую советом или текущую в сети. */
export enum DocumentTemplateEdition {
  Approved = 'approved',
  Current = 'current',
}

registerEnumType(DocumentTemplateEdition, {
  name: 'DocumentTemplateEdition',
  description: 'Редакция документа для просмотра: утверждённая советом кооператива или текущая в сети',
});

/**
 * Бланк документа: текст без данных субъекта, только с реквизитами
 * кооператива, как его видит совет при утверждении.
 */
@ObjectType('DocumentTemplateBlank')
export class DocumentTemplateBlankDTO {
  @Field(() => Int, { description: 'Номер шаблона в реестре документов' })
  registry_id!: number;

  @Field(() => String, { description: 'Название документа' })
  title!: string;

  @Field(() => String, { description: 'Текст документа в HTML' })
  html!: string;

  @Field(() => String, { description: 'Хэш текста' })
  text_hash!: string;
}
