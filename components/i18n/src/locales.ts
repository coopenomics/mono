/**
 * Языки платформы.
 *
 * Сейчас язык один — русский, и он же исходный: `ru` — эталон словарей,
 * каждая следующая локаль сверяется с ним гейтом `pnpm check:i18n`.
 * Второй язык добавляется строкой здесь и файлами словарей рядом с `ru`.
 */
export const SUPPORTED_LOCALES = ['ru'] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

/** Язык по умолчанию и запасной язык, когда перевода нет. */
export const DEFAULT_LOCALE: Locale = 'ru';

/**
 * Псевдолокаль для проверки глазами: текст из словаря обрамлён и удлинён,
 * поэтому невынесенная строка на экране сразу отличается от вынесенной.
 * В список поддерживаемых языков не входит.
 */
export const PSEUDO_LOCALE = 'ru-XA';

export function isSupportedLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/**
 * Выбирает поддерживаемый язык из заголовка `Accept-Language`
 * (`en-US,en;q=0.9,ru;q=0.8`). Весовые коэффициенты учитываются,
 * региональный вариант сводится к базовому языку.
 */
export function pickLocale(acceptLanguage: string | null | undefined): Locale | undefined {
  if (!acceptLanguage) return undefined;

  const candidates = acceptLanguage
    .split(',')
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(';');
      const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
      const weight = q ? Number(q.slice(2)) : 1;
      return { tag: tag.toLowerCase(), weight: Number.isFinite(weight) ? weight : 0, index };
    })
    .filter((c) => c.tag && c.weight > 0)
    .sort((a, b) => b.weight - a.weight || a.index - b.index);

  for (const { tag } of candidates) {
    if (isSupportedLocale(tag)) return tag;
    const base = tag.split('-')[0];
    if (isSupportedLocale(base)) return base;
  }
  return undefined;
}
