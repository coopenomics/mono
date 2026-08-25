/**
 * Объявление бакета `support:attachments` — вложения переписки обращений.
 *
 * Значения здесь СВОИ, а не унаследованные от расходов: у стола поддержки
 * пайщик прикладывает снимок экрана или скан документа, и предел вдвое ниже
 * (10 МБ против 20 МБ у расходов). `image/heic` в списке нет намеренно —
 * формат приходит только с техники Apple и в браузере без перекодирования не
 * показывается, а вложение обращения обязано открываться у оператора сразу.
 * Взамен добавлен `image/gif`: им приходят короткие записи экрана.
 *
 * Предел и белый список проверяет сам адаптер хранилища по этому объявлению
 * (`InnerFileStorageObjectTooLargeError` / `InnerFileStorageMimeRejectedError`),
 * поэтому прикладной слой своей проверки размера не делает — иначе правило
 * оказалось бы записано в двух местах и разошлось бы.
 *
 * Ключ объекта: `{coopname}/support/{ticket_id}/{checksum}.{ext}`.
 */
export const SUPPORT_BUCKET = {
  name: 'support:attachments',
  maxBytes: 10 * 1024 * 1024,
  allowedMime: [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf',
  ] as const,
  defaultUrlTtlSeconds: 600,
} as const;

export type SupportBucketAllowedMime = (typeof SUPPORT_BUCKET.allowedMime)[number];

/**
 * Расширение файла по MIME — только для читаемого ключа в хранилище.
 * Исходное имя файла в путь не идёт (модель, раздел 5): оно произвольное,
 * приходит от клиента и в ключе объекта ему делать нечего.
 */
export const SUPPORT_EXTENSION_BY_MIME: Record<SupportBucketAllowedMime, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
};
