import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { t, te } from '@coopenomics/i18n/server';

export type DomainErrorParams = Record<string, string | number | boolean | null | undefined>;

// Признак отказа с кодом. Фабрики возвращают наследников стандартных
// исключений Nest (`badRequest` — наследник BadRequestException и т. д.),
// поэтому `instanceof BadRequestException` в существующем коде и тестах
// продолжает работать, а `instanceof DomainError` узнаёт любой из них по признаку.
const DOMAIN_ERROR = Symbol.for('@coopenomics/extension-kit/DomainError');

interface Branded {
  code: string;
  params: DomainErrorParams;
}

/**
 * Текст отказа на языке текущего запроса. Кода нет в словаре, но есть
 * исходный текст (`params.message` — так приходит отказ контракта с кодом,
 * ещё не заведённым в словарь) — показывается он, а не ключ.
 */
export function domainErrorMessage(code: string, params: DomainErrorParams = {}): string {
  const key = `errors.${code}`;
  if (!te(key) && typeof params.message === 'string') return params.message;
  return t(key, params as Record<string, unknown>);
}

function body(code: string, params: DomainErrorParams, status: number) {
  return { statusCode: status, code, params, message: domainErrorMessage(code, params) };
}

function brand(target: HttpException & Branded, code: string, params: DomainErrorParams): void {
  target.code = code;
  target.params = params;
  (target as unknown as Record<symbol, boolean>)[DOMAIN_ERROR] = true;
  target.name = 'DomainError';
}

/**
 * Отказ, который видит пайщик: код + параметры, текст — из словаря.
 *
 * Код — `SCREAMING_SNAKE` с префиксом области (`CAPITAL_ISSUE_NOT_FOUND`),
 * сообщение — по ключу `errors.<КОД>` в словаре ядра или расширения.
 * `message` переводится при создании на язык текущего запроса (для журнала и
 * старого кода, читающего `error.message`); ответ клиенту фильтр ошибок
 * переводит заново на язык запроса и кладёт код в `extensions.code`,
 * параметры — в `extensions.params`.
 *
 * Бросать через фабрики по смыслу отказа:
 *   throw DomainError.notFound('FREE_DECISION_DOCUMENT_NOT_FOUND');
 *   throw DomainError.badRequest('WALLET_AMOUNT_TOO_SMALL', { min: '100,00 RUB' });
 */
export class DomainError extends HttpException implements Branded {
  public code!: string;
  public params!: DomainErrorParams;

  static [Symbol.hasInstance](value: unknown): boolean {
    return !!value && (value as Record<symbol, unknown>)[DOMAIN_ERROR] === true;
  }

  constructor(code: string, params: DomainErrorParams = {}, status: HttpStatus = HttpStatus.BAD_REQUEST) {
    super(body(code, params, status), status);
    brand(this, code, params);
  }

  /** Ключ сообщения в словаре. */
  get messageKey(): string {
    return `errors.${this.code}`;
  }

  static badRequest(code: string, params: DomainErrorParams = {}): DomainError {
    return new DomainBadRequest(code, params) as unknown as DomainError;
  }

  static unauthorized(code: string, params: DomainErrorParams = {}): DomainError {
    return new DomainUnauthorized(code, params) as unknown as DomainError;
  }

  static forbidden(code: string, params: DomainErrorParams = {}): DomainError {
    return new DomainForbidden(code, params) as unknown as DomainError;
  }

  static notFound(code: string, params: DomainErrorParams = {}): DomainError {
    return new DomainNotFound(code, params) as unknown as DomainError;
  }

  static conflict(code: string, params: DomainErrorParams = {}): DomainError {
    return new DomainConflict(code, params) as unknown as DomainError;
  }

  static unprocessable(code: string, params: DomainErrorParams = {}): DomainError {
    return new DomainUnprocessable(code, params) as unknown as DomainError;
  }

  static tooManyRequests(code: string, params: DomainErrorParams = {}): DomainError {
    return new DomainError(code, params, HttpStatus.TOO_MANY_REQUESTS);
  }

  static internal(code: string, params: DomainErrorParams = {}): DomainError {
    return new DomainInternal(code, params) as unknown as DomainError;
  }

  static badGateway(code: string, params: DomainErrorParams = {}): DomainError {
    return new DomainBadGateway(code, params) as unknown as DomainError;
  }

  static serviceUnavailable(code: string, params: DomainErrorParams = {}): DomainError {
    return new DomainServiceUnavailable(code, params) as unknown as DomainError;
  }
}

class DomainBadGateway extends BadGatewayException implements Branded {
  code!: string;
  params!: DomainErrorParams;
  constructor(code: string, params: DomainErrorParams) {
    super(body(code, params, HttpStatus.BAD_GATEWAY));
    brand(this, code, params);
  }
  get messageKey(): string {
    return `errors.${this.code}`;
  }
}

class DomainServiceUnavailable extends ServiceUnavailableException implements Branded {
  code!: string;
  params!: DomainErrorParams;
  constructor(code: string, params: DomainErrorParams) {
    super(body(code, params, HttpStatus.SERVICE_UNAVAILABLE));
    brand(this, code, params);
  }
  get messageKey(): string {
    return `errors.${this.code}`;
  }
}

class DomainBadRequest extends BadRequestException implements Branded {
  code!: string;
  params!: DomainErrorParams;
  constructor(code: string, params: DomainErrorParams) {
    super(body(code, params, HttpStatus.BAD_REQUEST));
    brand(this, code, params);
  }
  get messageKey(): string {
    return `errors.${this.code}`;
  }
}

class DomainUnauthorized extends UnauthorizedException implements Branded {
  code!: string;
  params!: DomainErrorParams;
  constructor(code: string, params: DomainErrorParams) {
    super(body(code, params, HttpStatus.UNAUTHORIZED));
    brand(this, code, params);
  }
  get messageKey(): string {
    return `errors.${this.code}`;
  }
}

class DomainForbidden extends ForbiddenException implements Branded {
  code!: string;
  params!: DomainErrorParams;
  constructor(code: string, params: DomainErrorParams) {
    super(body(code, params, HttpStatus.FORBIDDEN));
    brand(this, code, params);
  }
  get messageKey(): string {
    return `errors.${this.code}`;
  }
}

class DomainNotFound extends NotFoundException implements Branded {
  code!: string;
  params!: DomainErrorParams;
  constructor(code: string, params: DomainErrorParams) {
    super(body(code, params, HttpStatus.NOT_FOUND));
    brand(this, code, params);
  }
  get messageKey(): string {
    return `errors.${this.code}`;
  }
}

class DomainConflict extends ConflictException implements Branded {
  code!: string;
  params!: DomainErrorParams;
  constructor(code: string, params: DomainErrorParams) {
    super(body(code, params, HttpStatus.CONFLICT));
    brand(this, code, params);
  }
  get messageKey(): string {
    return `errors.${this.code}`;
  }
}

class DomainUnprocessable extends UnprocessableEntityException implements Branded {
  code!: string;
  params!: DomainErrorParams;
  constructor(code: string, params: DomainErrorParams) {
    super(body(code, params, HttpStatus.UNPROCESSABLE_ENTITY));
    brand(this, code, params);
  }
  get messageKey(): string {
    return `errors.${this.code}`;
  }
}

class DomainInternal extends InternalServerErrorException implements Branded {
  code!: string;
  params!: DomainErrorParams;
  constructor(code: string, params: DomainErrorParams) {
    super(body(code, params, HttpStatus.INTERNAL_SERVER_ERROR));
    brand(this, code, params);
  }
  get messageKey(): string {
    return `errors.${this.code}`;
  }
}

/**
 * Сообщение для class-validator по ключу словаря. Переводится в момент
 * проверки — на язык запроса, а не при загрузке модуля:
 *
 *   @IsNotEmpty({ message: validationMessage('validation.required') })
 *
 * В параметры сообщения попадают `property` (имя поля) и `value`.
 */
export function validationMessage(key: string, params: DomainErrorParams = {}) {
  return (args: { property: string; value?: unknown; constraints?: unknown[] }): string =>
    t(key, { property: args.property, value: String(args.value ?? ''), ...params });
}
