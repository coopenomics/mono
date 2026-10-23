/**
 * Spec бакета `registrator:charters` — уставы кооперативов, приложенные к заявке
 * на подключение к платформе.
 *
 * Устав загружает председатель подключающегося кооператива на первом шаге
 * мастера подключения; совет Восхода читает его в реестре кооперативов, когда
 * решает, подтверждать ли подключение. Хранение постоянное: устав остаётся
 * частью дела кооператива и после активации.
 *
 * Ключ объекта: `{coopname}/registrator/{username}/charter/{checksum}.{ext}`,
 * где `coopname` — контур союза (Восход), `username` — аккаунт кооператива.
 */
export const CHARTER_BUCKET = {
  name: 'registrator:charters',
  // Устав — многостраничный скан; двадцати мегабайт хватает с запасом, и это
  // тот же потолок, что у чеков и файлов расходов.
  maxBytes: 20 * 1024 * 1024,
  allowedMime: ['application/pdf', 'image/jpeg', 'image/png'] as const,
  // Ссылку открывает член совета прямо на экране реестра — десяти минут хватает.
  defaultUrlTtlSeconds: 600,
} as const;

export type CharterBucketAllowedMime = (typeof CHARTER_BUCKET.allowedMime)[number];

/** Расширение файла по MIME — для читаемого ключа в хранилище. */
export const CHARTER_EXTENSION_BY_MIME: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};
