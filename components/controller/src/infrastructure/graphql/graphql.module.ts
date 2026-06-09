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
import { Global, Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import config from '~/config/config';
import { ApolloFederationDriver, ApolloFederationDriverConfig } from '@nestjs/apollo';
import { docDirectiveTransformer } from './directives/doc.directive';
import { GraphQLError, GraphQLFormattedError } from 'graphql';
import { fieldAuthDirectiveTransformer } from './directives/fieldAuth.directive';
import logger from '~/config/logger';

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
      sortSchema: true,
      debug: config.env !== 'production',
      // context: ({ req }) => req,
      playground: { endpoint: '/v1/graphql', settings: { 'request.credentials': 'same-origin' } },
      path: '/v1/graphql', // здесь можно задать другой путь, когда потребуется,
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
