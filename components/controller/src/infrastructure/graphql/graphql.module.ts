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
import * as jwt from 'jsonwebtoken';
import { tokenTypes } from '~/types/token.types';

const GRAPHQL_PATH = '/v1/graphql';

/**
 * Bearer-токен из connectionParams ws-соединения. Принимаем и сам токен, и
 * форму `Bearer <token>` — клиенты Zeus шлют по-разному.
 */
function extractBearerToken(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw) return null;
  const match = raw.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : raw;
}

/**
 * Объявление директивы `@auth`, которую ставит декоратор `AuthRoles`.
 *
 * Объявление обязательно: без него graphql-tools отбрасывает аргументы, о
 * которых не знает, — директива продолжает работать, но «молча» теряет часть
 * условий доступа. Именно так потерялся `self`, пока директива держалась на
 * одном лишь `roles`.
 */
const authDirective = new GraphQLDirective({
  name: 'auth',
  description: 'Роли кооператива и пути принадлежности, открывающие поле его владельцу',
  locations: [DirectiveLocation.FIELD_DEFINITION, DirectiveLocation.OBJECT],
  args: {
    roles: { type: new GraphQLList(new GraphQLNonNull(GraphQLString)) },
    self: { type: new GraphQLList(new GraphQLNonNull(GraphQLString)) },
  },
});

/**
 * Realtime-подписки поверх graphql-ws на том же пути `/v1/graphql`.
 *
 * Почему не через `subscriptions:` драйвера: `ApolloFederationDriver`
 * отвергает эту опцию («No support for subscriptions yet when using Apollo
 * Federation»), а core-схема с E10 — subgraph федерации. Поэтому тот же
 * `GqlSubscriptionService`, который `ApolloDriver` поднимал бы сам, поднимается
 * здесь вручную на готовой (после transformSchema) схеме — см.
 * {@link GraphqlWsSubscriptionsBootstrap}. Опции и onConnect те же, что были
 * у драйвера: аутентификация соединения однократно, access-JWT из
 * connectionParams, `sub` в `extra`, невалидный токен → отказ.
 */
const graphqlWsSubscriptions: GraphQLWsSubscriptionsConfig = {
  path: GRAPHQL_PATH,
  onConnect: (context: any) => {
    const params = context?.connectionParams ?? {};
    const token = extractBearerToken(params.authorization ?? params.Authorization);
    if (!token) {
      logger.warn('[mp-ws] onConnect ОТКЛОНЁН: нет токена в connectionParams');
      return false;
    }
    try {
      const payload: any = jwt.verify(token, config.jwt.secret);
      if (payload?.type !== tokenTypes.ACCESS) {
        logger.warn(`[mp-ws] onConnect ОТКЛОНЁН: тип токена "${payload?.type}" != ACCESS`);
        return false;
      }
      context.extra = context.extra ?? {};
      context.extra.user = { sub: payload.sub };
      logger.info(`[mp-ws] onConnect ✅ принят: sub=${payload.sub}`);
      return true;
    } catch (e) {
      logger.warn(`[mp-ws] onConnect ОТКЛОНЁН: verify failed (${(e as Error).message})`);
      return false;
    }
  },
};

/**
 * Единый context для HTTP и WS. Для ws (graphql-ws Context содержит `extra`)
 * прокидываем аутентифицированного юзера в req.user, чтобы существующие
 * @CurrentUser/декораторы работали без изменений. Для HTTP — { req, res } как есть.
 */
const graphqlContext = (ctx: any) => {
  if (ctx && typeof ctx === 'object' && 'extra' in ctx) {
    return { req: { user: ctx.extra?.user ?? null, headers: {} } };
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
      logger.warn('[mp-ws] http-сервер недоступен — graphql-ws подписки не подняты');
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
    logger.info(`[mp-ws] graphql-ws подписки подняты на ${GRAPHQL_PATH} поверх federation-схемы`);
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
      // @auth из AuthRoles-декоратора должна быть ОБЪЯВЛЕНА в схеме (полное
      // объявление с `self` — см. authDirective выше), иначе композиция падает
      // «Unknown directive "@auth"» ещё до transformSchema.
      buildSchemaOptions: { directives: [authDirective] },
      sortSchema: true,
      debug: config.env !== 'production',
      // context: ({ req }) => req,
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
          // Извлекаем информацию о типе операции из запроса
          const queryText = context?.req?.body?.query || '';
          const operationType = queryText.trim().startsWith('mutation') ? 'mutation' :
                               queryText.trim().startsWith('query') ? 'query' :
                               queryText.trim().startsWith('subscription') ? 'subscription' : 'unknown';

          logger.error({
            message: `GraphQL Error: ${message}`,
            errorType: message.includes('used in position expecting type') ? 'GRAPHQL_TYPE_VALIDATION' : 'GRAPHQL_VALIDATION',
            extensions,
            locations: formattedError.locations,
            path: formattedError.path,
            username: context?.req?.user?.username || null,
            operation: context?.req?.body?.operationName || null,
            operationType,
            // Не показываем полный запрос, только тип операции
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
