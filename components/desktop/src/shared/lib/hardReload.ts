/**
 * Перезагрузка на свежую версию.
 *
 * Сносим ТОЛЬКО кэш навигаций (`navigations` из runtimeCaching) — иначе
 * NetworkFirst может отдать HTML предыдущего релиза из офлайн-запаса.
 * Precache Workbox (`workbox-precache-*`) НЕ трогаем: ассеты хешированы
 * (`useFilenameHashes: true`), старые записи безвредны, а их удаление
 * заставляет только что установившийся SW качать ~19 МБ заново — именно
 * это и укладывало SSR-ноду в 504 сразу после релиза (инцидент 2026-08-08).
 *
 * `_cr` в URL — cache-bust для HTTP-кэша документа.
 */
const NAVIGATION_CACHE = 'navigations';

export async function hardReload(): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.includes(NAVIGATION_CACHE))
          .map((key) => caches.delete(key)),
      );
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('[hardReload] не удалось очистить кэш навигаций', error);
  }

  const url = new URL(window.location.href);
  url.searchParams.set('_cr', String(Date.now()));
  window.location.replace(url.toString());
}
