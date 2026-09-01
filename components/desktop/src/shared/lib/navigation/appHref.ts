import { resolveRouterMode } from './entryUrl';

/**
 * Внутренний путь приложения → href с учётом режима роутера.
 *
 * Прод работает в history-режиме (маршрут в pathname, без `#`), dev — в hash.
 * Канонический формат ссылок платформы — БЕЗ `#` (так их строит и сервер в
 * письмах); входящий адрес приводит к режиму роутера normalizeEntryUrl
 * (./entryUrl, вызывается до createRouter). Но для
 * НАВИГАЦИИ ИЗНУТРИ приложения прямое `window.location.hash = …` работает
 * только в hash-режиме — на проде хэш молча игнорируется роутером. Отсюда
 * этот helper: он строит href под фактический режим.
 */
export function appHref(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return resolveRouterMode() === 'history' ? normalized : `/#${normalized}`;
}

/**
 * Полная навигация на внутренний путь вне vue-router (стор, обработчик тоста,
 * оверлей без контекста роутера). В history-режиме `assign` сам перезагружает
 * страницу; в hash-режиме смена хэша даёт SPA-переход без перезагрузки — если
 * нужен именно перезапуск приложения (сброс состояния), передай `reload: true`.
 */
export function navigateToPath(path: string, options: { reload?: boolean } = {}): void {
  window.location.assign(appHref(path));
  if (options.reload && resolveRouterMode() !== 'history') {
    window.location.reload();
  }
}
