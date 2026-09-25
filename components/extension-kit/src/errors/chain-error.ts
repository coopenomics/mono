import { DomainError } from './domain-error';

const ASSERT_PREFIX = /assertion failure with message: (.+?)(?:\n|$)/;
const CODED = /^([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+):\s*(.*)$/s;

/**
 * Разбор отказа контракта. Контракт пишет причину как `КОД: текст`
 * (`GATEWAY_OUTCOME_NOT_FOUND: Объект возврата не существует…`); старые
 * отказы — одним текстом, без кода.
 */
export function parseChainAssert(message: string): { code?: string; text: string } {
  const assert = message.match(ASSERT_PREFIX);
  const body = (assert ? assert[1] : message).trim();
  const coded = body.match(CODED);
  return coded ? { code: coded[1], text: coded[2].trim() } : { text: body };
}

/**
 * Код отказа контракта — из DomainError, в который отказ уже превращён,
 * или из сырой ошибки цепи. Отказ без кода — undefined. Сравнивать отказы
 * контракта — по этому коду, а не по тексту: текст переводится и правится.
 */
export function chainErrorCode(error: unknown): string | undefined {
  if (error instanceof DomainError) {
    if (error.code !== 'CHAIN_ASSERT' && error.code !== 'CHAIN_ERROR') return error.code;
    return typeof error.params.message === 'string' ? parseChainAssert(error.params.message).code : undefined;
  }
  const raw = (error as { message?: string })?.message ?? String(error);
  return parseChainAssert(raw).code;
}

/**
 * Отказ контракта (`eosio::check`) как отказ с кодом; иной сбой цепи — null.
 *
 * Отказ контракта — ответ на действие пайщика, а не сбой сервера. Клиент цепи
 * (@wharfkit/session) превращает его в простой Error, и без перевода он уходил
 * ответом 500 без кода — в журнал ошибок как поломка (C28-80). Переводит
 * единственная отправка в цепь, поэтому код получают все мутации сразу.
 */
export function chainRefusalOf(error: unknown): DomainError | null {
  if (error instanceof DomainError) return error;
  const raw: string = (error as { message?: string })?.message ?? String(error);
  if (!ASSERT_PREFIX.test(raw)) return null;
  const { code, text } = parseChainAssert(raw);
  return DomainError.badRequest(code ?? 'CHAIN_ASSERT', { message: text });
}

/**
 * Пробросить отказ цепи человеку.
 *
 * `eosio::check` возвращает сообщение обёрнутым в `assertion failure with
 * message: ...`; пайщику нужна причина, а не обёртка виртуальной машины.
 * Живёт в каркасе, потому что в цепь ходит не одно расширение: вторая копия
 * этой чистки разошлась бы с первой на первом же новом формате ошибки.
 *
 * Отказ с кодом (`КОД: текст`) уходит с этим кодом, текст — из словаря,
 * а без записи в словаре — текст контракта. Отказ без кода — `CHAIN_ASSERT`,
 * прочий сбой цепи — `CHAIN_ERROR`, текст — параметром `message`.
 */
export function rethrowChainError(error: unknown): never {
  // Отказ, уже переведённый отправкой в цепь, уходит как есть.
  if (error instanceof DomainError) throw error;
  const raw: string = (error as { message?: string })?.message ?? String(error);
  const match = raw.match(ASSERT_PREFIX);
  if (!match) throw DomainError.badRequest('CHAIN_ERROR', { message: raw });
  const { code, text } = parseChainAssert(raw);
  throw DomainError.badRequest(code ?? 'CHAIN_ASSERT', { message: text });
}
