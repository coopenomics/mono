import { ObjectType, Field, Int } from '@nestjs/graphql';

@ObjectType('SearchResult')
export class SearchResultDTO {
  @Field(() => String, { description: 'Хеш документа' })
  hash!: string;

  @Field(() => String, { description: 'Полный заголовок документа' })
  full_title!: string;

  @Field(() => String, { description: 'Имя пользователя' })
  username!: string;

  @Field(() => String, { description: 'ФИО подписанта документа' })
  signer!: string;

  @Field(() => String, { description: 'Кооператив' })
  coopname!: string;

  @Field(() => Int, { description: 'ID реестра документа' })
  registry_id!: number;

  @Field(() => String, { description: 'Дата создания', nullable: true })
  created_at?: string;

  @Field(() => [String], { description: 'Найденные фрагменты с подсветкой' })
  highlights!: string[];
}
