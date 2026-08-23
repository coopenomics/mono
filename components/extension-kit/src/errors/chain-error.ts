import { BadRequestException } from '@nestjs/common';

/**
 * Пробросить отказ цепи человеку.
 *
 * `eosio::check` возвращает сообщение обёрнутым в `assertion failure with
 * message: ...`; пайщику нужна причина, а не обёртка виртуальной машины.
 * Живёт в каркасе, потому что в цепь ходит не одно расширение: вторая копия
 * этой чистки разошлась бы с первой на первом же новом формате ошибки.
 */
export function rethrowChainError(error: unknown): never {
  const raw: string = (error as { message?: string })?.message ?? String(error);
  const match = raw.match(/assertion failure with message: (.+?)(?:\n|$)/);
  const clean = match ? match[1].trim() : raw;
  throw new BadRequestException(clean);
}
