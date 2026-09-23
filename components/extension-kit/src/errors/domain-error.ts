import { HttpException, HttpStatus } from '@nestjs/common';
import { t } from '@coopenomics/i18n/server';

export type DomainErrorParams = Record<string, string | number | boolean | null | undefined>;

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
export class DomainError extends HttpException {
  public readonly code: string;
  public readonly params: DomainErrorParams;

  constructor(code: string, params: DomainErrorParams = {}, status: HttpStatus = HttpStatus.BAD_REQUEST) {
    const message = t(`errors.${code}`, params as Record<string, unknown>);
    super({ statusCode: status, code, params, message }, status);
    this.code = code;
    this.params = params;
    this.name = 'DomainError';
  }

  /** Ключ сообщения в словаре. */
  get messageKey(): string {
    return `errors.${this.code}`;
  }

  static badRequest(code: string, params?: DomainErrorParams): DomainError {
    return new DomainError(code, params, HttpStatus.BAD_REQUEST);
  }

  static unauthorized(code: string, params?: DomainErrorParams): DomainError {
    return new DomainError(code, params, HttpStatus.UNAUTHORIZED);
  }

  static forbidden(code: string, params?: DomainErrorParams): DomainError {
    return new DomainError(code, params, HttpStatus.FORBIDDEN);
  }

  static notFound(code: string, params?: DomainErrorParams): DomainError {
    return new DomainError(code, params, HttpStatus.NOT_FOUND);
  }

  static conflict(code: string, params?: DomainErrorParams): DomainError {
    return new DomainError(code, params, HttpStatus.CONFLICT);
  }

  static unprocessable(code: string, params?: DomainErrorParams): DomainError {
    return new DomainError(code, params, HttpStatus.UNPROCESSABLE_ENTITY);
  }

  static tooManyRequests(code: string, params?: DomainErrorParams): DomainError {
    return new DomainError(code, params, HttpStatus.TOO_MANY_REQUESTS);
  }

  static internal(code: string, params?: DomainErrorParams): DomainError {
    return new DomainError(code, params, HttpStatus.INTERNAL_SERVER_ERROR);
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
