import { Catch, HttpException, HttpStatus, ExecutionContext } from '@nestjs/common';
import { GqlExceptionFilter, GqlExecutionContext } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';
import mongoose from 'mongoose';
import { RpcError } from 'eosjs';
import * as Sentry from '@sentry/nestjs';
import logger from '../../../config/logger';
import { config } from '~/config';
import { DomainError, HttpApiError } from '@coopenomics/extension-kit';
import { runWithLocale, t, type DomainErrorParamsLike } from '~/i18n';
import { resolveRequestLocale } from '~/i18n/request-locale';

@Catch()
export class GraphQLExceptionFilter implements GqlExceptionFilter {
  catch(exception: any, host: ExecutionContext) {
    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal Server Error';
    // Код отказа для клиента (`extensions.code`) и его параметры. Есть у
    // DomainError и у отказа цепи; у прочих ошибок код — HTTP-статус, как раньше.
    let errorCode: string | undefined;
    let errorParams: DomainErrorParamsLike | undefined;
    let request: any;

    const contextType = host.getType() as string;
    let user;
    let operationName;
    let fieldName;
    let path;
    // Чьи данные спрашивали. В отказе по правам это главный вопрос: без имени
    // нельзя отличить «стучались к чужому» от «клиент отправил запрос про себя,
    // не подставив имя» — а выглядят эти случаи одинаково.
    let requestedUsername: string | undefined;
    let locations: Array<{ line: number; column: number }> = [];

    // Получаем информацию в зависимости от типа контекста
    if (contextType === 'graphql') {
      const gqlContext = GqlExecutionContext.create(host);
      const context = gqlContext.getContext();
      request = context?.req;
      user = context?.req?.user;

      const args = gqlContext.getArgs<Record<string, any>>();
      requestedUsername = args?.data?.username ?? args?.filter?.username ?? args?.username;

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
      request = req;
      user = req.user;
      operationName = `${req.method} ${req.url}`;
      path = req.path;
    }

    // Текст ответа — на языке запроса. Язык берётся из самого запроса, а не
    // только из контекста: фильтр может выполняться вне цепочки middleware.
    const locale = resolveRequestLocale(request);
    const tr = (key: string, params?: DomainErrorParamsLike) => runWithLocale(locale, () => t(key, params));

    // Обработка ValidationPipe ошибок
    let originalMessage = message; // Сохраняем оригинальное сообщение для логов
    if (exception instanceof DomainError) {
      statusCode = exception.getStatus();
      errorCode = exception.code;
      errorParams = exception.params;
      message = tr(exception.messageKey, exception.params);
      originalMessage = `${exception.code}: ${message}`;
    } else if (exception instanceof HttpException) {
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
        const generic: Partial<Record<number, string>> = {
          [HttpStatus.BAD_REQUEST]: 'COMMON_BAD_REQUEST',
          [HttpStatus.UNAUTHORIZED]: 'COMMON_UNAUTHORIZED',
          [HttpStatus.FORBIDDEN]: 'COMMON_FORBIDDEN',
          [HttpStatus.NOT_FOUND]: 'COMMON_NOT_FOUND',
          [HttpStatus.CONFLICT]: 'COMMON_CONFLICT',
        };
        errorCode = generic[statusCode] ?? 'COMMON_INTERNAL';
        message = tr(`errors.${errorCode}`);
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
        requested_username: requestedUsername ?? null,
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
        requested_username: requestedUsername ?? null,
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
      errorCode = 'CHAIN_ASSERT';
      errorParams = { message };
    } else if (exception instanceof mongoose.Error) {
      statusCode = HttpStatus.BAD_REQUEST;
      message = exception.message;
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    // Отказ с кодом ниже 500 — штатный ответ сервера на действие клиента, а не
    // его поломка: истёкшая сессия, нет прав, неверный код из письма, конфликт
    // параллельной правки, сканер, перебирающий `/.env`. Раньше каждый такой
    // отказ уходил в журнал ошибок, и за десять дней там набралось 11 тысяч
    // событий против четырёх настоящих ошибок сервера — одна вкладка с
    // отозванной сессией дала их почти все. Отказы остаются в логе контроллера
    // предупреждением: всплеск 401 виден там, а журнал ошибок снова про ошибки.
    const isExpectedRefusal = statusCode < HttpStatus.INTERNAL_SERVER_ERROR;

    // Отправка ошибки в Sentry для отслеживания
    if (!isExpectedRefusal) {
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
          requested_username: requestedUsername ?? null,
          operationName: operationName || null,
          fieldName: fieldName || null,
          path: path || null,
        });

        // Отправляем ошибку в Sentry
        Sentry.captureException(exception);
      });
    }

    // Логирование ошибки - используем оригинальное сообщение для детального логирования
    const logMessage = exception instanceof HttpApiError && !exception.isOperational ? originalMessage : message;
    // В журнал DomainError пишется с кодом: по нему отказ ищется в логах.
    const journalMessage = exception instanceof DomainError ? originalMessage : logMessage;

    const logData = {
      message: `${journalMessage}`,
      statusCode,
      stack: exception.stack,
      username: user?.username || null,
      requested_username: requestedUsername ?? null,
      operation: operationName || null,
      field: fieldName || null,
      path: path || null,
      locations,
    };

    if (isExpectedRefusal) {
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
        ...(errorCode && { code: errorCode, params: errorParams ?? {} }),
      });
    }

    // Возвращение ошибки в формате GraphQL.
    // Доменные GraphQLError с собственными extensions (например CONTENT_CONFLICT с обеими версиями текста)
    // сохраняют их: клиент различает такие ошибки по code и читает payload.
    const domainExtensions =
      exception instanceof GraphQLError && exception.extensions ? exception.extensions : {};
    // `code` — код отказа, если он есть (DomainError, отказ цепи), иначе
    // HTTP-статус, как было; `status` — всегда HTTP-статус. Клиент различает
    // отказы по коду, а текст `message` уже переведён на язык запроса.
    return new GraphQLError(message, {
      extensions: {
        code: errorCode ?? statusCode,
        status: statusCode,
        ...(errorCode && { params: errorParams ?? {} }),
        isExecutionError: true, // Флаг для отличия execution ошибок от validation ошибок
        ...(process.env.NODE_ENV === 'development' && { stacktrace: exception.stack }),
        ...domainExtensions,
      },
    });
  }
}
