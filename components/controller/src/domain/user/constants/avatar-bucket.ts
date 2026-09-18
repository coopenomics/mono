/**
 * Хранилище фотографий пайщиков: одна на аккаунт, показывается в удостоверении
 * пайщика и везде, где платформа рисует человека — в столах расширений тоже,
 * через порт `USER_AVATAR_PORT`.
 *
 * Ограничение размера намеренно скромное: это портрет в кружке, а не документ.
 */
export const AVATAR_BUCKET = {
  name: 'core:avatars',
  maxBytes: 5 * 1024 * 1024,
  allowedMime: ['image/jpeg', 'image/png', 'image/webp'] as const,
  defaultUrlTtlSeconds: 3600,
} as const;

export type AvatarAllowedMime = (typeof AVATAR_BUCKET.allowedMime)[number];
