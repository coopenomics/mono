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
import { authenticateWsConnection } from './ws-connection-auth';

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
      // connectionParams и кладём `sub` с именем аккаунта в `extra`, чтобы операции читали юзера
      // из контекста. Невалидный/отсутствующий токен → соединение отклоняется.
      subscriptions: {
        'graphql-ws': {
          path: '/v1/graphql',
          onConnect: async (context: any) => {
            const auth = await authenticateWsConnection(context?.connectionParams, config.jwt.secret);
            if (!auth.ok) {
              logger.warn(`[mp-ws] onConnect ОТКЛОНЁН: ${auth.reason}`);
              return false;
            }
            context.extra = context.extra ?? {};
            context.extra.user = auth.user;
            logger.info(`[mp-ws] onConnect ✅ принят: ${auth.user.username}`);
            return true;
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
  providers: [],
  exports: [GraphQLModule],
})
export class GraphqlModule {}
