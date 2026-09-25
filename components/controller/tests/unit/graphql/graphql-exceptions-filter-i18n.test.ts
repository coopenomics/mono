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
import { DomainError, HttpApiError, chainErrorCode, chainRefusalOf, rethrowChainError, validationMessage } from '@coopenomics/extension-kit';

jest.mock('@sentry/nestjs', () => ({
  withScope: (callback: (scope: unknown) => void) =>
    callback({ setTag: jest.fn(), setUser: jest.fn(), setContext: jest.fn() }),
  captureException: jest.fn(),
}));
jest.mock('~/config/logger', () => ({ __esModule: true, default: { warn: jest.fn(), error: jest.fn(), info: jest.fn() } }));
jest.mock('~/config', () => ({ config: { coopname: 'voskhod' } }));

import { GraphQLExceptionFilter } from '~/infrastructure/graphql/filters/graphql-exceptions.filter';
import { AuthV2Error, AuthV2ErrorCode, authV2HttpStatus } from '~/domain/auth-v2/errors/auth-v2.error';

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

  // До 25.09.2026 не-UUID вместо идентификатора давал ответ 500 с текстом
  // базы — 80 операций матрицы прав (C28-80).
  it('значение не разобралось как тип колонки (Postgres 22P02) — отказ 400 с кодом, без текста базы', () => {
    const dbError = Object.assign(new Error('invalid input syntax for type uuid: "abc"'), {
      name: 'QueryFailedError',
      driverError: { code: '22P02' },
    });
    const result = filter.catch(dbError, gqlHost()) as GraphQLError;

    expect(result.extensions.code).toBe('COMMON_INVALID_VALUE_FORMAT');
    expect(result.extensions.status).toBe(HttpStatus.BAD_REQUEST);
    expect(result.message).not.toContain('uuid');
  });

  // До 25.09.2026 отказ двухфакторки в GraphQL-мутации уходил ответом 500:
  // статусы контура CoopID знал только его REST-фильтр (C28-80).
  it('отказ контура CoopID — статус и код те же, что в REST', () => {
    const error = new AuthV2Error(AuthV2ErrorCode.TwoFactorNotEnrolled, 'Второй фактор не подключён.');
    const result = filter.catch(error, gqlHost()) as GraphQLError;

    expect(result.message).toBe('Второй фактор не подключён.');
    expect(result.extensions.code).toBe('two_factor_not_enrolled');
    expect(result.extensions.status).toBe(HttpStatus.BAD_REQUEST);
    expect(result.extensions.status).toBe(authV2HttpStatus(AuthV2ErrorCode.TwoFactorNotEnrolled));
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

  it('отказ контракта с кодом уходит с этим кодом, текст — из словаря', () => {
    let thrown: unknown;
    try {
      rethrowChainError(
        new Error('assertion failure with message: GATEWAY_OUTCOME_NOT_FOUND: Объект возврата не существует с указанным хэшем'),
      );
    } catch (e) {
      thrown = e;
    }
    expect((thrown as DomainError).code).toBe('GATEWAY_OUTCOME_NOT_FOUND');
    expect((thrown as DomainError).message).toBe('Объект возврата не существует с указанным хэшем');
    expect(chainErrorCode(thrown)).toBe('GATEWAY_OUTCOME_NOT_FOUND');
  });

  it('код контракта без записи в словаре — показывается текст контракта, а не ключ', () => {
    let thrown: unknown;
    try {
      rethrowChainError(new Error('assertion failure with message: SOME_NEW_CONTRACT_CODE: Новый отказ контракта'));
    } catch (e) {
      thrown = e;
    }
    expect((thrown as DomainError).code).toBe('SOME_NEW_CONTRACT_CODE');
    expect((thrown as DomainError).message).toBe('Новый отказ контракта');
  });

  it('код читается и из сырой ошибки цепи; отказ без кода — undefined', () => {
    expect(chainErrorCode(new Error('assertion failure with message: REGISTRATOR_VERIFICATION_NOT_OURS: текст'))).toBe(
      'REGISTRATOR_VERIFICATION_NOT_OURS',
    );
    expect(chainErrorCode(new Error('assertion failure with message: Голосование еще не завершено'))).toBeUndefined();
  });

  it('прочий сбой цепи — CHAIN_ERROR с исходным текстом', () => {
    expect(() => rethrowChainError(new Error('ECONNREFUSED'))).toThrow('ECONNREFUSED');
    expect(chainRefusalOf(new Error('ECONNREFUSED'))).toBeNull();
  });

  // До 25.09.2026 сумма без символа или текст вместо номера падали при
  // кодировании действия и уходили ответом 500 с текстом кодировщика (C28-80).
  it('значение не укладывается в тип поля действия — отказ 400 с именем поля', () => {
    const refusal = chainRefusalOf(new Error('Encoding error at root<fundprog>.amount<asset>: Invalid asset string'));
    expect(refusal).toBeInstanceOf(DomainError);
    expect(refusal!.code).toBe('CHAIN_ACTION_ARGUMENT_INVALID');
    expect(refusal!.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    expect(refusal!.message).toBe('Значение поля «amount» записано неправильно');

    const nested = chainRefusalOf(new Error('Encoding error at root<act>.doc<document2>.meta<string>: bad'));
    expect(nested!.params).toEqual({ field: 'doc.meta' });
  });

  it('сообщение class-validator переводится в момент проверки', () => {
    const message = validationMessage('validation.required');
    expect(message({ property: 'email', value: '' })).toBe('Это поле обязательно для заполнения');
  });

  it('код без сообщения в словаре отдаёт ключ — пропуск виден сразу', () => {
    expect(DomainError.badRequest('NO_SUCH_CODE_IN_DICTIONARY').message).toBe('errors.NO_SUCH_CODE_IN_DICTIONARY');
  });
});
