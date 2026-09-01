import { Catch, HttpException, HttpStatus, ExecutionContext } from '@nestjs/common';
import { GqlExceptionFilter, GqlExecutionContext } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';
import mongoose from 'mongoose';
import { RpcError } from 'eosjs';
import * as Sentry from '@sentry/nestjs';
import logger from '../../../config/logger';
import { config } from '~/config';
import { HttpApiError } from '@coopenomics/extension-kit';

@Catch()
export class GraphQLExceptionFilter implements GqlExceptionFilter {
  catch(exception: any, host: ExecutionContext) {
    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal Server Error';

    const contextType = host.getType() as string;
    let user;
    let operationName;
    let fieldName;
    let path;
    let locations: Array<{ line: number; column: number }> = [];

    // Получаем информацию в зависимости от типа контекста
    if (contextType === 'graphql') {
      const gqlContext = GqlExecutionContext.create(host);
      const context = gqlContext.getContext();
      user = context?.req?.user;

      const info = gqlContext.getInfo();
      operationName = info?.operation?.name?.value;
      fieldName = info?.fieldName;
      path = info?.path?.typename ? `${info.path.typename}.${fieldName}` : fieldName;

      locations = info?.operation?.loc?.startToken
        ? [
            {
              line: info.operation.loc.startToken.line,
              column: info.operation.loc.startToken.column,
            },
          ]
        : [];
    } else if (contextType === 'http') {
      const ctx = host.switchToHttp();
      const req = ctx.getRequest();
      user = req.user;
      operationName = `${req.method} ${req.url}`;
      path = req.path;
    }

    // Обработка ValidationPipe ошибок
    let originalMessage = message; // Сохраняем оригинальное сообщение для логов
    if (exception instanceof HttpException) {
      const response = exception.getResponse();

      if (typeof response === 'object' && response['message']) {
        message = Array.isArray(response['message']) ? response['message'].join(', ') : response['message'];
      } else {
        message = exception.message;
      }

      originalMessage = message; // Сохраняем для логов
      statusCode = exception.getStatus();

      // Проверяем isOperational для HttpApiError
      if (exception instanceof HttpApiError && !exception.isOperational) {
        // Для неоперационных ошибок показываем стандартное сообщение
        switch (statusCode) {
          case HttpStatus.BAD_REQUEST:
            message = 'Неверный запрос';
            break;
          case HttpStatus.UNAUTHORIZED:
            message = 'Не авторизован';
            break;
          case HttpStatus.FORBIDDEN:
            message = 'Доступ запрещен';
            break;
          case HttpStatus.NOT_FOUND:
            message = 'Ресурс не найден';
            break;
          case HttpStatus.CONFLICT:
            message = 'Конфликт данных';
            break;
          default:
            message = 'Внутренняя ошибка сервера';
        }
      }
    }

    // Обработка GraphQL Validation ошибок (например, несоответствие типов переменных)
    else if (exception instanceof GraphQLError && exception.message.includes('used in position expecting type')) {
      statusCode = HttpStatus.BAD_REQUEST;
      message = exception.message;

      // Специальное логирование для ошибок типов GraphQL
      logger.error({
        message: `GraphQL Type Validation Error: ${message}`,
        statusCode,
        stack: exception.stack,
        username: user?.username || null,
        operation: operationName || null,
        field: fieldName || null,
        path: path || null,
        locations: exception.locations || locations,
        extensions: exception.extensions,
        originalError: exception.originalError?.message || null,
      });
    }
    // Обработка других GraphQLError
    else if (exception instanceof GraphQLError) {
      statusCode = HttpStatus.BAD_REQUEST;
      message = exception.message;

      // Логируем все GraphQL ошибки для отладки
      logger.error({
        message: `GraphQL Error: ${message}`,
        statusCode,
        stack: exception.stack,
        username: user?.username || null,
        operation: operationName || null,
        field: fieldName || null,
        path: path || null,
        locations: exception.locations || locations,
        extensions: exception.extensions,
        originalError: exception.originalError?.message || null,
      });
    }
    // Обработка конкретных типов исключений
    else if (exception instanceof RpcError) {
      message = exception.json.error.details[0].message.replace('assertion failure with message: ', '');
      statusCode = exception.json.code;
    } else if (exception instanceof mongoose.Error) {
      statusCode = HttpStatus.BAD_REQUEST;
      message = exception.message;
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    // Отправка ошибки в Sentry для отслеживания
    Sentry.withScope((scope) => {
      // Добавляем дополнительную информацию в scope
      scope.setTag('error_type', 'graphql');
      scope.setTag('status_code', statusCode.toString());
      scope.setTag('coopname', config.coopname);

      if (user?.username) {
        scope.setUser({ username: user.username });
      }

      if (operationName) {
        scope.setTag('operation', operationName);
      }

      if (fieldName) {
        scope.setTag('field', fieldName);
      }

      if (path) {
        scope.setTag('path', path);
      }

      // Добавляем контекст GraphQL запроса
      scope.setContext('graphql', {
        operation: operationName,
        field: fieldName,
        path: path,
        locations: locations,
      });

      // Добавляем контекст запроса
      scope.setContext('request', {
        username: user?.username || null,
        operationName: operationName || null,
        fieldName: fieldName || null,
        path: path || null,
      });

      // Отправляем ошибку в Sentry
      Sentry.captureException(exception);
    });

    // Логирование ошибки - используем оригинальное сообщение для детального логирования
    const logMessage = exception instanceof HttpApiError && !exception.isOperational ? originalMessage : message;

    const logData = {
      message: `${logMessage}`,
      statusCode,
      stack: exception.stack,
      username: user?.username || null,
      operation: operationName || null,
      field: fieldName || null,
      path: path || null,
      locations,
    };

    if (statusCode === HttpStatus.UNAUTHORIZED) {
      logger.warn(logData);
    } else {
      logger.error(logData);
    }

    // Если это HTTP запрос (REST API), отправляем нормальный JSON ответ
    if (host.getType() === 'http') {
      const ctx = host.switchToHttp();
      const response = ctx.getResponse();
      
      if (response.locals) {
        response.locals.errorMessage = logMessage;
      }
      
      return response.status(statusCode).json({
        statusCode,
        message: logMessage,
        error: exception instanceof Error ? exception.constructor.name : 'Error',
      });
    }

    // Возвращение ошибки в формате GraphQL.
    // Доменные GraphQLError с собственными extensions (например CONTENT_CONFLICT с обеими версиями текста)
    // сохраняют их: клиент различает такие ошибки по code и читает payload.
    const domainExtensions =
      exception instanceof GraphQLError && exception.extensions ? exception.extensions : {};
    return new GraphQLError(message, {
      extensions: {
        code: statusCode,
        isExecutionError: true, // Флаг для отличия execution ошибок от validation ошибок
        ...(process.env.NODE_ENV === 'development' && { stacktrace: exception.stack }),
        ...domainExtensions,
      },
    });
  }
}
