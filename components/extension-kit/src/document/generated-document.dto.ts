// Типы полей GraphQL указаны явными thunk'ами, а не выведены из TypeScript.
// Пакет собирается esbuild'ом, а он не эмитит `design:type`: без thunk'а поле
// осталось бы без типа и сборка схемы упала бы уже в приложении-потребителе.
import { ObjectType, Field } from '@nestjs/graphql';
import { IsString, IsObject } from 'class-validator';
import type { GeneratedDocumentDomainInterface } from './generated-document.contract';
import { GraphQLJSON } from 'graphql-type-json';
@ObjectType('GeneratedDocument')
export class GeneratedDocumentDTO implements GeneratedDocumentDomainInterface {
  @Field(() => String, { description: 'Полное название документа' })
  @IsString()
  full_title!: string;

  @Field(() => String, { description: 'HTML содержимое документа' })
  @IsString()
  html!: string;

  @Field(() => String, { description: 'Хэш документа' })
  @IsString()
  hash!: string;

  @Field(() => GraphQLJSON, { description: 'Метаданные документа' })
  meta!: any;

  @Field(() => String, { description: 'Бинарное содержимое документа (base64)' })
  @IsObject()
  binary!: string;

  constructor(data?: GeneratedDocumentDomainInterface) {
    if (data) {
      this.full_title = data.full_title;
      this.html = data.html;
      this.hash = data.hash;
      this.meta = data.meta;
      this.binary = data.binary;
    }
  }
}
