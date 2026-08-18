import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Ошибка API с кодом состояния HTTP.
 *
 * Переехала из `~/utils/httpApiError` контроллера: расширения бросают её
 * напрямую, а этого пути за пределами монолита нет.
 *
 * `isOperational` отделяет ожидаемый отказ (нет прав, не найдено, конфликт) от
 * сбоя: первый — нормальный ответ пайщику, второй должен попасть в трассировку.
 * `subcode` — доменный код отказа для клиента, когда одного статуса мало.
 */
export class HttpApiError extends HttpException {
  public readonly isOperational: boolean;
  public readonly subcode: any;

  constructor(statusCode: HttpStatus, message: string, isOperational = true, stack?: string, subcode?: any) {
    super(message, statusCode);
    this.isOperational = isOperational;
    this.subcode = subcode;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}
