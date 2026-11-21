/**
 * Хранилище логотипа кооператива. Лежит отдельно от портретов пайщиков: у
 * логотипа свой срок жизни и свой ключ в настройках кооператива.
 *
 * Ограничение размера скромное: это кружок в шапке профиля, а не документ.
 */
export const COOP_LOGO_BUCKET = {
  name: 'core:coop-logo',
  maxBytes: 5 * 1024 * 1024,
  allowedMime: ['image/jpeg', 'image/png', 'image/webp'] as const,
  defaultUrlTtlSeconds: 3600,
} as const;

export type CoopLogoAllowedMime = (typeof COOP_LOGO_BUCKET.allowedMime)[number];
