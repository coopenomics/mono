// modules/appstore/dto/extension-graphql-input.dto.ts
import { InputType, Field } from '@nestjs/graphql';
import type { ExtensionDomainInterface } from '@coopenomics/extension-kit';
import { GraphQLJSON } from 'graphql-type-json';

@InputType('ExtensionInput')
export class ExtensionGraphQLInput<TConfig = any> implements ExtensionDomainInterface {
  @Field(() => String, { description: 'Уникальное имя расширения (является идентификатором)' })
  name!: string;

  @Field(() => Boolean, { description: 'Флаг того, включено ли расширение сейчас' })
  enabled!: boolean;

  @Field(() => GraphQLJSON, { description: 'Объект конфигурации расширения' })
  config!: TConfig;

  @Field(() => Date, { nullable: true, description: 'Дата установки расширения' })
  created_at?: Date;

  @Field(() => Date, { nullable: true, description: 'Дата обновления расширения' })
  updated_at?: Date;
}
