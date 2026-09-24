import { DEFAULT_LOCALE, pickLocale, type Locale } from '@coopenomics/i18n';

/**
 * Язык запроса. Порядок источников: язык пользователя → язык кооператива →
 * заголовок `Accept-Language` → язык по умолчанию. Языка у пользователя и
 * кооператива пока нет (язык один), поэтому работает заголовок и умолчание;
 * когда появятся — встают сюда первыми.
 */
export function resolveRequestLocale(req: { headers?: Record<string, unknown> } | undefined | null): Locale {
  const header = req?.headers?.['accept-language'];
  return pickLocale(typeof header === 'string' ? header : undefined) ?? DEFAULT_LOCALE;
}
