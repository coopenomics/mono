/**
 * Жёсткая перезагрузка с обходом кэша:
 * очищает Cache Storage (PWA/Workbox) и уходит на URL с cache-bust параметром.
 * Обычный location.reload() часто подтягивает старый index/бандлы из HTTP-кэша.
 */
export async function hardReload(): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('[hardReload] не удалось очистить Cache Storage', error);
  }

  const url = new URL(window.location.href);
  url.searchParams.set('_cr', String(Date.now()));
  window.location.replace(url.toString());
}
