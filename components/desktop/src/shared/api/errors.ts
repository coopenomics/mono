import { IBaseReadBlockchainErrors } from '../lib/types/errors';
import { FailAlert } from '../api/alerts';
import { t } from 'src/shared/i18n';

export function createBaseReadBlockchainErrors(
  name: string
): IBaseReadBlockchainErrors {
  return {
    loadError: createBlockchainGetError(name),
  };
}

export function createBlockchainGetError(name: string) {
  return t('api.error.chainLoad', { name });
}

export function handleException(e: unknown): void {
  if (e instanceof Error) {
    FailAlert(e);
  } else {
    FailAlert(t('api.error.unknownOccurred'));
  }
}

export function extractGraphQLErrorMessages(error: unknown): string {
  if (typeof error === 'string') return error;
  if (!error || typeof error !== 'object') return t('api.error.unknown');

  // Проверяем, если ошибка уже является массивом
  if (Array.isArray(error)) {
    return error.map((err: any) => err.message || t('api.error.unknown')).join('; ');
  }

  // Объект с полем `errors`: так устроен GraphQLResponseError из SDK (исходный
  // список ошибок сервера лежит в `errors`, `message` — те же тексты через «; »),
  // так же выглядит ответ Apollo Client. Через эту ветку идут FailAlert и все,
  // кто показывает текст отказа сервера.
  const errors = (error as any).errors;
  if (Array.isArray(errors)) {
    return errors.map((err: any) => err.message || t('api.error.unknown')).join('; ');
  }

  // Обработка специфических ошибок Matrix
  const message = (error as any).message;
  if (message === 'MATRIX_USERNAME_EXISTS') {
    return t('api.error.matrixUsernameExists');
  }
  if (message === 'MATRIX_EMAIL_EXISTS') {
    return t('api.error.matrixEmailExists');
  }

  // Обработка в случае, если ошибка — одиночная
  return message || t('api.error.unknown');
}

/**
 * Коды отказа из ответа сервера (`extensions.code` каждой ошибки GraphQL).
 * Отказ различается по коду, а не по тексту: текст переводится на язык запроса.
 */
export function extractErrorCodes(error: unknown): string[] {
  if (!error || typeof error !== 'object') return [];
  const list = Array.isArray(error) ? error : Array.isArray((error as any).errors) ? (error as any).errors : [error];
  return list.map((e: any) => e?.extensions?.code).filter((c: unknown): c is string => typeof c === 'string');
}

/** Есть ли в ответе сервера отказ с одним из кодов. */
export function hasErrorCode(error: unknown, ...codes: string[]): boolean {
  return extractErrorCodes(error).some((c) => codes.includes(c));
}

/**
 * Проверяет, содержит ли ошибка GraphQL указанные параметры
 * @param error - ошибка GraphQL (может быть массивом или объектом)
 * @param options - параметры для проверки
 * @param options.code - код ошибки (например, 500)
 * @param options.message - текст сообщения ошибки
 * @returns true если ошибка соответствует критериям
 */
export function isGraphQLError(
  error: unknown,
  options: { code?: number; message?: string }
): boolean {
  if (!error || typeof error !== 'object') return false;

  // Получаем массив ошибок для проверки
  let errorsToCheck: any[] = [];

  if (Array.isArray(error)) {
    errorsToCheck = error;
  } else {
    // Проверяем поле errors (Apollo Client)
    const errors = (error as any).errors;
    if (Array.isArray(errors)) {
      errorsToCheck = errors;
    } else {
      // Одиночная ошибка
      errorsToCheck = [error];
    }
  }

  // Проверяем каждую ошибку
  return errorsToCheck.some((err: any) => {
    // Проверяем код, если указан
    if (options.code !== undefined && err?.extensions?.code !== options.code) {
      return false;
    }

    // Проверяем сообщение, если указано
    if (options.message !== undefined && err?.message !== options.message) {
      return false;
    }

    return true;
  });
}
