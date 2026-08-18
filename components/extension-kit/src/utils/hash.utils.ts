import crypto from 'crypto';

/**
 * Хэши, которыми расширение помечает свои сущности.
 *
 * Уникальный хэш нужен там, где идентификатор придумывается до записи в цепь:
 * платёж, черновик документа, заявка. Хэш от строки — там, где идентификатор
 * обязан воспроизводиться: два одинаковых входа дают один результат, и
 * повторный вызов не заводит вторую сущность.
 */

/** Уникальный хэш: время плюс случайное число. Воспроизвести его нельзя. */
export function generateUniqueHash(): string {
  const timestamp = Date.now();
  const randomValue = Math.random().toString();
  return crypto.createHash('sha256').update(`${timestamp}-${randomValue}`).digest('hex');
}

/** То же, что `generateUniqueHash`; имя сохранено, потому что так его зовут в коде. */
export function generateRandomHash(): string {
  return generateUniqueHash();
}

/** Воспроизводимый хэш от строки — для идемпотентности. */
export function generateHashFromString(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}
