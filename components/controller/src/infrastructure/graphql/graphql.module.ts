// infrastructure/graphql/graphql.module.ts
//
// Epic 10 / Story 10.1 — coopback переключён с ApolloDriver на
// ApolloFederationDriver. Локальная core-схема становится первым subgraph'ом
// федерации; gateway-режим зайдёт отдельным процессом (10.1b / 10.3 orchestrator),
// когда появится первый внешний subgraph (chatcoop и т.д.).
//
// На MVP клиенты не должны заметить переключения: subgraph endpoint на том же
// `/v1/graphql`, federation v2 добавляет лишь служебные `_service { sdl }` и
// `_entities` query. Старые desktop-сессии продолжают работать.
import { Global, Injectable, Module, type OnApplicationBootstrap, type OnModuleDestroy } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import {
  GqlSubscriptionService,
  GraphQLModule,
  GraphQLSchemaHost,
  type GraphQLWsSubscriptionsConfig,
} from '@nestjs/graphql';
import config from '~/config/config';
import { ApolloFederationDriver, ApolloFederationDriverConfig } from '@nestjs/apollo';
import { docDirectiveTransformer } from './directives/doc.directive';
import {
  DirectiveLocation,
  GraphQLDirective,
  GraphQLError,
  GraphQLFormattedError,
  GraphQLList,
  GraphQLNonNull,
  GraphQLString,
} from 'graphql';
import { fieldAuthDirectiveTransformer } from './directives/fieldAuth.directive';
import logger from '~/config/logger';
import { authenticateWsConnection, buildWsContext } from './ws-auth.registry';

const GRAPHQL_PATH = '/v1/graphql';

/**
 * Объявление директивы `@auth`, которую ставит на поле объекта декоратор `CouncilField`.
 *
 * Объявление обязательно: без него graphql-tools отбрасывает аргументы, о
 * которых не знает, — директива продолжает работать, но «молча» теряет часть
 * условий доступа. Именно так потерялся `self`, пока директива держалась на
 * одном лишь `roles`.
 */
const authDirective = new GraphQLDirective({
  name: 'auth',
  // i18n-ignore: текст автогенерируемой GraphQL-документации директивы для разработчиков API, не интерфейс пайщика
  description: 'Роли кооператива и пути принадлежности, открывающие поле его владельцу',
  locations: [DirectiveLocation.FIELD_DEFINITION, DirectiveLocation.OBJECT],
  args: {
    roles: { type: new GraphQLList(new GraphQLNonNull(GraphQLString)) },
    self: { type: new GraphQLList(new GraphQLNonNull(GraphQLString)) },
  },
});

/**
 * Что за операция дала ошибку разбора. Раньше это пытались достать из запроса
 * (`context.req.body`), но третьего аргумента у `formatError` в Apollo 4 нет:
 * в журнал шли `operation: null` и `operationType: "unknown"` — по ним нельзя
 * было понять, кто из клиентов шлёт негодный запрос. Имя берётся из самого
 * документа, на который ссылается ошибка; переменные не трогаем — в них
 * персональные данные.
 */
function describeOperation(error: unknown): { operation: string | null; operationType: string } {
  const body = (error as GraphQLError)?.nodes?.[0]?.loc?.source?.body;
  if (!body) return { operation: null, operationType: 'unknown' };

  const match = body.match(/\b(query|mutation|subscription)\b[^{(]*/);
  if (!match) return { operation: null, operationType: 'query' }; // сокращённая форма `{ ... }`

  const name = match[0].slice(match[1].length).trim().split(/[\s(]/)[0];
  return { operationType: match[1], operation: name || null };
}

/**
 * Realtime-подписки поверх graphql-ws на том же пути `/v1/graphql`.
 *
 * Почему не через `subscriptions:` драйвера: `ApolloFederationDriver`
 * отвергает эту опцию («No support for subscriptions yet when using Apollo
 * Federation»), а core-схема с E10 — subgraph федерации. Поэтому тот же
 * `GqlSubscriptionService`, который `ApolloDriver` поднимал бы сам, поднимается
 * вручную на готовой (после transformSchema) схеме — см.
 * {@link GraphqlWsSubscriptionsBootstrap}. Соединение опознаётся однократно в
 * onConnect тем же путём, что HTTP-запрос (JwtAuthStrategy), а контекст
 * операции подписки повторяет форму HTTP-запроса — см. ws-auth.registry.ts.
 */
const graphqlWsSubscriptions: GraphQLWsSubscriptionsConfig = {
  path: GRAPHQL_PATH,
  onConnect: authenticateWsConnection,
};

/** Единый context для HTTP и WS: для ws — форма HTTP-запроса, для HTTP — { req, res } как есть. */
const graphqlContext = (ctx: any) => {
  if (ctx && typeof ctx === 'object' && 'extra' in ctx) {
    return buildWsContext(ctx);
  }
  return ctx;
};

/**
 * Поднимает graphql-ws сервер после сборки федеративной схемы и гасит его при
 * остановке приложения. Повторяет то, что `ApolloDriver.start()` делает при
 * `subscriptions:` — federation-драйвер этого не умеет.
 */
@Injectable()
class GraphqlWsSubscriptionsBootstrap implements OnApplicationBootstrap, OnModuleDestroy {
  private service: GqlSubscriptionService | null = null;

  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
    private readonly schemaHost: GraphQLSchemaHost
  ) {}

  onApplicationBootstrap(): void {
    const httpServer = this.httpAdapterHost.httpAdapter?.getHttpServer();
    if (!httpServer) {
      logger.warn('[ws] http-сервер недоступен — graphql-ws подписки не подняты');
      return;
    }
    this.service = new GqlSubscriptionService(
      {
        schema: this.schemaHost.schema,
        path: GRAPHQL_PATH,
        context: graphqlContext,
        'graphql-ws': graphqlWsSubscriptions,
      },
      httpServer
    );
    logger.info(`[ws] graphql-ws подписки подняты на ${GRAPHQL_PATH} поверх federation-схемы`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.service?.stop();
  }
}

@Global()
@Module({
  imports: [
    GraphQLModule.forRoot<ApolloFederationDriverConfig>({
      driver: ApolloFederationDriver,
      introspection: true,
      autoSchemaFile: {
        path: 'schema.gql',
        federation: 2,
      },
      // buildSubgraphSchema (federation v2) валидирует SDL строго: директива
      // @auth должна быть ОБЪЯВЛЕНА в схеме (полное объявление — authDirective
      // выше), иначе композиция падает «Unknown directive "@auth"» ещё до
      // transformSchema.
      buildSchemaOptions: { directives: [authDirective] },
      sortSchema: true,
      debug: config.env !== 'production',
      playground: { endpoint: GRAPHQL_PATH, settings: { 'request.credentials': 'same-origin' } },
      path: GRAPHQL_PATH,
      context: graphqlContext,
      transformSchema: (schema) => {
        schema = docDirectiveTransformer(schema, 'auth');
        schema = fieldAuthDirectiveTransformer(schema, 'auth');
        return schema;
      },
      // transformSchema: (schema) => docDirectiveTransformer(schema, 'auth'),
      formatError: (formattedError: GraphQLFormattedError, error: unknown, context?: any): GraphQLFormattedError => {
        let extensions = formattedError.extensions || {};
        let message = formattedError.message;
        if (error instanceof GraphQLError) {
          // Если есть оригинальная ошибка, извлекаем информацию
          if (error.originalError instanceof Error) {
            message = error.originalError.message;
            extensions = {
              ...extensions,
              code: extensions.code || 'INTERNAL_SERVER_ERROR',
              stacktrace: process.env.NODE_ENV === 'development' ? error.originalError.stack : undefined,
            };
          }
        } else if (error instanceof Error) {
          // Для ошибок, которые не являются GraphQLError
          message = error.message;
          extensions = {
            ...extensions,
            code: 'INTERNAL_SERVER_ERROR',
            stacktrace: process.env.NODE_ENV === 'development' ? error.stack : undefined,
          };
        }

        // Устанавливаем errorMessage для Morgan логов через context
        if (context?.res) {
          context.res.locals.errorMessage = message;
        }


        // Логирование GraphQL ошибок (только validation ошибки, execution ошибки логируются в GraphQLExceptionFilter)
        if (extensions.code !== 401 && !formattedError.extensions?.isExecutionError) {
          const { operation, operationType } = describeOperation(error);

          logger.error({
            message: `GraphQL Error: ${message}`,
            errorType: message.includes('used in position expecting type') ? 'GRAPHQL_TYPE_VALIDATION' : 'GRAPHQL_VALIDATION',
            extensions,
            locations: formattedError.locations,
            path: formattedError.path,
            operation,
            operationType,
            // Не показываем полный запрос, только имя и тип операции
          });
        }

        return {
          message,
          extensions,
        };
      },
    }),
  ],
  providers: [GraphqlWsSubscriptionsBootstrap],
  exports: [GraphQLModule],
})
export class GraphqlModule {}
