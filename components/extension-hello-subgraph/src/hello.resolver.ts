import { Args, Field, ObjectType, Query, Resolver } from '@nestjs/graphql';

@ObjectType('HelloResponse')
class HelloResponse {
  @Field(() => String)
  greeting!: string;

  @Field(() => String)
  fromExtension!: string;
}

/**
 * Минимальный subgraph resolver — доказывает что Federation v2 driver
 * поднимается на @coopenomics/extension-sdk. Cross-extension entity
 * references (SharedCooperator @key + @external + ResolveField) живут
 * в реальном chatcoop subgraph'е (story 10.8) — там есть локальная
 * сущность ChatThread которая может ссылаться на пайщика.
 */
@Resolver()
export class HelloResolver {
  @Query(() => HelloResponse, { name: 'helloFromExtension' })
  hello(@Args('name') name: string): HelloResponse {
    return {
      greeting: `Здравствуй, ${name}!`,
      fromExtension: 'hello-subgraph@0.1.0',
    };
  }
}
