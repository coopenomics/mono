/**
 * Отказ пайщику — код + текст на языке запроса.
 *
 * DomainError несёт код и параметры, текст подставляется из словаря: клиент
 * различает отказы по `extensions.code`, а читает переведённый `message`.
 * Прежние исключения со свободным текстом продолжают работать как раньше —
 * перенос на коды идёт постепенно и не должен ломать ответы по дороге.
 */
import { BadRequestException, HttpStatus } from '@nestjs/common';
import { GraphQLError } from 'graphql';
import { DomainError, HttpApiError, rethrowChainError, validationMessage } from '@coopenomics/extension-kit';

jest.mock('@sentry/nestjs', () => ({
  withScope: (callback: (scope: unknown) => void) =>
    callback({ setTag: jest.fn(), setUser: jest.fn(), setContext: jest.fn() }),
  captureException: jest.fn(),
}));
jest.mock('~/config/logger', () => ({ __esModule: true, default: { warn: jest.fn(), error: jest.fn(), info: jest.fn() } }));
jest.mock('~/config', () => ({ config: { coopname: 'voskhod' } }));

import { GraphQLExceptionFilter } from '~/infrastructure/graphql/filters/graphql-exceptions.filter';

function gqlHost(headers: Record<string, string> = {}) {
  const req = { headers, user: undefined };
  const args = [{}, {}, { req }, { fieldName: 'publishProjectOfFreeDecision', path: {}, operation: { name: { value: 'Op' } } }];
  return {
    getType: () => 'graphql',
    getArgs: () => args,
    getArgByIndex: (i: number) => args[i],
    getClass: () => Object,
    getHandler: () => () => undefined,
  } as any;
}

function httpHost() {
  const response = { locals: {}, status: jest.fn(), json: jest.fn() };
  response.status.mockReturnValue(response);
  const request = { method: 'POST', url: '/v1/x', path: '/v1/x', headers: { 'accept-language': 'ru-RU' }, user: undefined };
  return {
    host: {
      getType: () => 'http',
      switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
    } as any,
    response,
  };
}

describe('GraphQLExceptionFilter: коды отказов и перевод', () => {
  const filter = new GraphQLExceptionFilter();

  it('DomainError — текст из словаря, код в extensions.code, статус отдельно', () => {
    const result = filter.catch(DomainError.notFound('DOCUMENT_NOT_FOUND'), gqlHost()) as GraphQLError;

    expect(result.message).toBe('Документ не найден');
    expect(result.extensions.code).toBe('DOCUMENT_NOT_FOUND');
    expect(result.extensions.status).toBe(HttpStatus.NOT_FOUND);
    expect(result.extensions.params).toEqual({});
  });

  it('DomainError с параметрами подставляет их в текст и отдаёт клиенту', () => {
    const error = DomainError.badRequest('FREE_DECISION_WRONG_REGISTRY', { expected: 101 });
    const result = filter.catch(error, gqlHost({ 'accept-language': 'en-US,ru;q=0.5' })) as GraphQLError;

    expect(result.message).toBe('Неверный registry_id в переданном документе, ожидается registry_id == 101');
    expect(result.extensions.params).toEqual({ expected: 101 });
    // message самой ошибки тоже переведён — его читают журнал и старый код
    expect(error.message).toBe(result.message);
  });

  it('прежнее исключение со свободным текстом отвечает как раньше', () => {
    const result = filter.catch(new BadRequestException('Старый текст отказа'), gqlHost()) as GraphQLError;

    expect(result.message).toBe('Старый текст отказа');
    expect(result.extensions.code).toBe(HttpStatus.BAD_REQUEST);
    expect(result.extensions.status).toBe(HttpStatus.BAD_REQUEST);
    expect(result.extensions.params).toBeUndefined();
  });

  it('неоперационная HttpApiError — общее сообщение из словаря с общим кодом', () => {
    const exception = new HttpApiError(HttpStatus.FORBIDDEN, 'внутренняя причина', false);
    const result = filter.catch(exception, gqlHost()) as GraphQLError;

    expect(result.message).toBe('Доступ запрещен');
    expect(result.extensions.code).toBe('COMMON_FORBIDDEN');
  });

  it('непредвиденная ошибка — статус 500 числом, как раньше', () => {
    const result = filter.catch(new TypeError('boom'), gqlHost()) as GraphQLError;

    expect(result.extensions.code).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(result.extensions.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
  });

  it('REST-ответ несёт код и параметры рядом с текстом', () => {
    const { host, response } = httpHost();
    filter.catch(DomainError.conflict('DOCUMENT_NOT_FOUND'), host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Документ не найден', code: 'DOCUMENT_NOT_FOUND', params: {} }),
    );
  });
});

describe('отказ цепи и сообщения валидации', () => {
  it('отказ контракта уходит с кодом CHAIN_ASSERT и текстом контракта', () => {
    let thrown: unknown;
    try {
      rethrowChainError(new Error('assertion failure with message: Голосование еще не завершено\npending console output:'));
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(DomainError);
    expect((thrown as DomainError).code).toBe('CHAIN_ASSERT');
    expect((thrown as DomainError).message).toBe('Голосование еще не завершено');
  });

  it('прочий сбой цепи — CHAIN_ERROR с исходным текстом', () => {
    expect(() => rethrowChainError(new Error('ECONNREFUSED'))).toThrow('ECONNREFUSED');
  });

  it('сообщение class-validator переводится в момент проверки', () => {
    const message = validationMessage('validation.required');
    expect(message({ property: 'email', value: '' })).toBe('Это поле обязательно для заполнения');
  });

  it('код без сообщения в словаре отдаёт ключ — пропуск виден сразу', () => {
    expect(DomainError.badRequest('NO_SUCH_CODE_IN_DICTIONARY').message).toBe('errors.NO_SUCH_CODE_IN_DICTIONARY');
  });
});
