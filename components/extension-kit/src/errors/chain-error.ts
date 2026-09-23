import { DomainError } from './domain-error';

/**
 * Пробросить отказ цепи человеку.
 *
 * `eosio::check` возвращает сообщение обёрнутым в `assertion failure with
 * message: ...`; пайщику нужна причина, а не обёртка виртуальной машины.
 * Живёт в каркасе, потому что в цепь ходит не одно расширение: вторая копия
 * этой чистки разошлась бы с первой на первом же новом формате ошибки.
 *
 * Отказ уходит с кодом `CHAIN_ASSERT`, текст контракта — параметром `message`.
 * Контракты пока пишут причину по-русски текстом; когда перейдут на коды,
 * код разбирается здесь и превращается в код ошибки платформы.
 */
export function rethrowChainError(error: unknown): never {
  const raw: string = (error as { message?: string })?.message ?? String(error);
  const match = raw.match(/assertion failure with message: (.+?)(?:\n|$)/);
  if (match) throw DomainError.badRequest('CHAIN_ASSERT', { message: match[1].trim() });
  throw DomainError.badRequest('CHAIN_ERROR', { message: raw });
}
