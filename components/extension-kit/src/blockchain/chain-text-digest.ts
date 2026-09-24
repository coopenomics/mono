import { createHash } from 'crypto';

/**
 * Тексты в цепи хранятся хешем.
 *
 * Содержательный текст (описание проекта, формулировка вопроса собрания) живёт в базе
 * контроллера, а в строке таблицы цепи лежит его sha256 в шестнадцатеричной записи или
 * пустая строка. Контракт принимает только такие значения (lib/core/text_digest.hpp),
 * поэтому хеш одной и той же строки совпадает на обеих сторонах.
 */
const DIGEST_RE = /^[0-9a-f]{64}$/;

/** sha256 текста в UTF-8; пустой текст остаётся пустой строкой. */
export function chainTextDigest(text: string | null | undefined): string {
  if (!text) return '';
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/** Значение из цепи — хеш текста, а не сам текст. */
export function isChainTextDigest(value: string | null | undefined): value is string {
  return typeof value === 'string' && DIGEST_RE.test(value);
}

/**
 * Значение поля из цепи для записи в базу: хеш текст в базе не заменяет.
 * Строки, записанные до выноса текстов, несут сам текст и копируются как раньше.
 */
export function resolveChainText(chainValue: string, current: string | null | undefined): string {
  return isChainTextDigest(chainValue) ? current ?? '' : chainValue;
}
