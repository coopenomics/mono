// infrastructure/graphql/graphql.module.ts
import { Global, Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import config from '~/config/config';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
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

@Global()
@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      introspection: true,
      autoSchemaFile: 'schema.gql',
      buildSchemaOptions: { directives: [authDirective] },
      sortSchema: true,
      debug: config.env !== 'production',
      // context: ({ req }) => req,
      playground: { endpoint: '/v1/graphql', settings: { 'request.credentials': 'same-origin' } },
      path: '/v1/graphql', // здесь можно задать другой путь, когда потребуется,
      // Realtime-подписки поверх graphql-ws на том же пути. Аутентификация
      // соединения — однократно в onConnect: верифицируем access-JWT из
      // connectionParams и кладём `sub` в `extra`, чтобы операции читали юзера
      // из контекста. Невалидный/отсутствующий токен → соединение отклоняется.
      subscriptions: {
        'graphql-ws': {
          path: '/v1/graphql',
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
        },
      },
      // Единый context для HTTP и WS. Для ws (graphql-ws Context содержит
      // `extra`) прокидываем аутентифицированного юзера в req.user, чтобы
      // существующие @CurrentUser/декораторы работали без изменений. Для HTTP
      // возвращаем { req, res } как есть.
      context: (ctx: any) => {
        if (ctx && typeof ctx === 'object' && 'extra' in ctx) {
          return { req: { user: ctx.extra?.user ?? null, headers: {} } };
        }
        return ctx;
      },
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
  providers: [],
  exports: [GraphQLModule],
})
export class GraphqlModule {}
