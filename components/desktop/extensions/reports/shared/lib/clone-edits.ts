/**
 * Копия правок формы отчёта перед записью поля.
 *
 * Правки — простой JSON (собираются из ответа сервера), поэтому копия через
 * JSON точна и заодно снимает реактивные обёртки Vue. structuredClone здесь
 * нельзя по двум причинам: на реактивном прокси он бросает DataCloneError, а
 * в браузерах, которые объявляет сборка (Chrome 87, Safari 13.1), его нет
 * вовсе (C28-94).
 */
export function cloneEdits<T>(edits: T): T {
  return JSON.parse(JSON.stringify(edits)) as T
}
