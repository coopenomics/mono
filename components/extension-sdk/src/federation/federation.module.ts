import { DynamicModule, Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloFederationDriver, ApolloFederationDriverConfig } from '@nestjs/apollo';

/**
 * Опции для базового федеративного subgraph'а расширения.
 *
 * @property path           — путь endpoint'а GraphQL (по умолчанию `/v1/graphql`).
 * @property schemaFile     — куда писать сгенерированную SDL; не задан — схема только в памяти.
 * @property introspection  — оставлять true даже в проде: gateway пользуется
 *                            introspection'ом для пересборки supergraph'а.
 * @property playground     — Apollo Sandbox в development.
 */
export interface ExtensionFederationOptions {
  path?: string;
  schemaFile?: string;
  introspection?: boolean;
  playground?: boolean;
}

/**
 * Стандартный модуль федеративного subgraph'а расширения.
 *
 * Подключается в `imports` корневого `AppModule` расширения:
 *
 *   imports: [ExtensionFederationModule.forRoot({ path: '/v1/graphql' })]
 *
 * Драйвер `ApolloFederationDriver` + `autoSchemaFile.federation: 2` дают
 * subgraph совместимый с Apollo Gateway. На стороне расширения никаких
 * настроек федерации больше делать не надо — `@key/@requires/@external`
 * объявляются прямо в @ObjectType классах через @Directive.
 */
@Module({})
export class ExtensionFederationModule {
  static forRoot(options: ExtensionFederationOptions = {}): DynamicModule {
    const path = options.path ?? '/v1/graphql';
    const schemaFile = options.schemaFile;
    const introspection = options.introspection ?? true;
    const playground = options.playground ?? false;

    return {
      module: ExtensionFederationModule,
      imports: [
        GraphQLModule.forRoot<ApolloFederationDriverConfig>({
          driver: ApolloFederationDriver,
          path,
          introspection,
          playground,
          // Схема по умолчанию держится в памяти. Файл пишется, только если
          // приложение само задало путь: контейнер приложения работает без
          // прав root, и запись в каталог приложения роняла его на старте.
          autoSchemaFile: schemaFile === undefined ? { federation: 2 } : { path: schemaFile, federation: 2 },
          sortSchema: true,
        }),
      ],
      exports: [GraphQLModule],
    };
  }
}
