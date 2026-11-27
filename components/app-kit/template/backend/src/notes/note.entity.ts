import { Directive, Field, ID, ObjectType } from '@nestjs/graphql';

/**
 * Локальная сущность расширения — заметка пайщика.
 *
 * `@key(fields: "id")` отмечает Note как entity в Federation v2 —
 * на неё можно ссылаться из других subgraph'ов по id.
 *
 * `authorUsername` — внешний ключ на core-entity `Cooperator` (EOSIO
 * account name). В рабочем пакете на этом месте стоит отношение `@requires`
 * либо ResolveReference на SharedCooperator.
 */
@ObjectType('Note')
@Directive('@key(fields: "id")')
export class Note {
  @Field(() => ID)
  id!: string;

  @Field(() => String, { description: 'EOSIO username пайщика-автора' })
  authorUsername!: string;

  @Field(() => String)
  body!: string;

  @Field(() => String, { description: 'ISO-8601 момент создания' })
  createdAt!: string;
}
