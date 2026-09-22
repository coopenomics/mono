import { createHash } from 'crypto';

/**
 * Тексты проекта (описание, приглашение) в цепи хранятся хешем.
 *
 * Сам текст живёт в базе контроллера, в строке capital::projects лежит sha256 текста в
 * шестнадцатеричной записи или пустая строка. Контракт принимает только такие значения
 * (Capital::Projects::check_text_digest) и тем же способом переводит старые строки в
 * capital::migrate, поэтому хеш от одной и той же строки совпадает на обеих сторонах.
 */
const DIGEST_RE = /^[0-9a-f]{64}$/;

export function chainTextDigest(text: string | null | undefined): string {
  if (!text) return '';
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

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

/** Поля проекта, которые в цепи хранятся хешем. */
export const PROJECT_CHAIN_TEXT_FIELDS = ['description', 'invite'] as const;
export type ProjectChainTextField = (typeof PROJECT_CHAIN_TEXT_FIELDS)[number];
export type ProjectChainTexts = Partial<Record<ProjectChainTextField, string>>;

/**
 * Поля, где текст в базе не сходится с хешем в цепи. Пустой хеш в цепи при непустом
 * тексте тоже расхождение: значит, текст в базе появился мимо цепи.
 */
export function chainTextMismatches(
  chain: Record<ProjectChainTextField, string>,
  texts: ProjectChainTexts
): ProjectChainTextField[] {
  return PROJECT_CHAIN_TEXT_FIELDS.filter((field) => {
    const chainValue = chain[field] ?? '';
    if (!isChainTextDigest(chainValue) && chainValue !== '') return false;
    return chainTextDigest(texts[field]) !== chainValue;
  });
}
