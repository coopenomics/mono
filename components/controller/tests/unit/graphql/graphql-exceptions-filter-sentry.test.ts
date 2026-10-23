/**
 * Что фильтр исключений отправляет в журнал ошибок (GlitchTip).
 *
 * Отказ с кодом ниже 500 — штатный ответ на действие клиента (истёкшая сессия,
 * нет прав, сканер `/.env`, конфликт правки), в журнал ошибок он не идёт и
 * пишется в лог предупреждением. Всё, что 500 и выше или вовсе не HTTP-ошибка,
 * отправляется как раньше.
 */
import {
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { GraphQLError } from 'graphql';
import { HttpApiError } from '@coopenomics/extension-kit';

const mockCaptureException = jest.fn();
jest.mock('@sentry/nestjs', () => ({
  withScope: (callback: (scope: unknown) => void) =>
    callback({ setTag: jest.fn(), setUser: jest.fn(), setContext: jest.fn() }),
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}));

const mockLogger = { warn: jest.fn(), error: jest.fn(), info: jest.fn() };
jest.mock('~/config/logger', () => ({ __esModule: true, default: mockLogger }));
jest.mock('~/config', () => ({ config: { coopname: 'voskhod' } }));

import { GraphQLExceptionFilter } from '~/infrastructure/graphql/filters/graphql-exceptions.filter';

function httpHost() {
  const response = { locals: {}, status: jest.fn(), json: jest.fn() };
  response.status.mockReturnValue(response);
  const request = { method: 'GET', url: '/.env', path: '/.env', user: undefined };
  return {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
  } as any;
}

describe('GraphQLExceptionFilter: журнал ошибок только для ошибок сервера', () => {
  const filter = new GraphQLExceptionFilter();

  beforeEach(() => {
    mockCaptureException.mockClear();
    mockLogger.warn.mockClear();
    mockLogger.error.mockClear();
  });

  it.each([
    ['отозванная сессия', new UnauthorizedException('Сессия завершена, требуется повторная авторизация')],
    ['нет прав', new ForbiddenException('Доступ только для пайщиков кооператива')],
    ['сканер адресов', new NotFoundException('Cannot GET /.env')],
    ['неверный код из письма', new HttpApiError(400, 'Неверный код. Проверьте письмо и попробуйте ещё раз.')],
    ['конфликт параллельной правки', new GraphQLError('Документ изменён параллельно', { extensions: { code: 'CONTENT_CONFLICT' } })],
  ])('%s — не отправляется, пишется предупреждением', (_case, exception) => {
    filter.catch(exception, httpHost());

    expect(mockCaptureException).not.toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalledTimes(1);
  });

  it('ошибка сервера с кодом 500 отправляется и пишется ошибкой', () => {
    const exception = new InternalServerErrorException('Сломалось');

    filter.catch(exception, httpHost());

    expect(mockCaptureException).toHaveBeenCalledWith(exception);
    expect(mockLogger.error).toHaveBeenCalled();
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  it('необработанное исключение кода отправляется', () => {
    const exception = new TypeError("Cannot read properties of undefined (reading 'config')");

    filter.catch(exception, httpHost());

    expect(mockCaptureException).toHaveBeenCalledWith(exception);
  });
});
