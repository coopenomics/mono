/**
 * Spec бакета `coopid:verification` — снимки сверки личности на кооперативном
 * участке: фотография пайщика, разворота паспорта и пайщика с паспортом.
 *
 * Хранение временное: снимки живут ровно до решения совета и удаляются вместе
 * с ним. Задача сверки узкая — убедиться, что за заказом пришёл тот, кто
 * зарегистрирован в кооперативе; копии чужих паспортов после её решения
 * кооперативу не нужны и только создают риск утечки.
 *
 * Ключ объекта: `{coopname}/verification/{review_id}/{checksum}.{ext}`.
 */
export const VERIFICATION_BUCKET = {
  name: 'coopid:verification',
  // Снимок с телефона оператора — единицы мегабайт; десяти хватает с запасом.
  maxBytes: 10 * 1024 * 1024,
  allowedMime: ['image/jpeg', 'image/png', 'image/webp', 'image/heic'] as const,
  // Ссылку открывает председатель прямо на экране проверки — минуты достаточно.
  defaultUrlTtlSeconds: 300,
} as const;

export type VerificationBucketAllowedMime = (typeof VERIFICATION_BUCKET.allowedMime)[number];

/** Расширение файла по MIME — для читаемого ключа в хранилище. */
export const VERIFICATION_PHOTO_EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
};

/** Сколько снимков принимаем за одну сверку. */
export const VERIFICATION_PHOTOS_MAX = 5;
