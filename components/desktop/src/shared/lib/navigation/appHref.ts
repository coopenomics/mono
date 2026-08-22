import { env } from 'src/shared/config';

/**
 * Внутренний путь приложения → href с учётом режима роутера.
 *
 * Прод работает в history-режиме (маршрут в pathname, без `#`), dev — в hash.
 * Канонический формат ссылок платформы — БЕЗ `#` (так их строит и сервер в
 * письмах); App.vue при загрузке нормализует URL под свой режим. Но для
 * НАВИГАЦИИ ИЗНУТРИ приложения прямое `window.location.hash = …` работает
 * только в hash-режиме — на проде хэш молча игнорируется роутером. Отсюда
 * этот helper: он строит href под фактический режим.
 */
export function appHref(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const mode = env.VUE_ROUTER_MODE || process.env.VUE_ROUTER_MODE || 'hash';
  return mode === 'history' ? normalized : `/#${normalized}`;
}

/**
 * Полная навигация на внутренний путь вне vue-router (стор, обработчик тоста,
 * оверлей без контекста роутера). В history-режиме `assign` сам перезагружает
 * страницу; в hash-режиме смена хэша даёт SPA-переход без перезагрузки — если
 * нужен именно перезапуск приложения (сброс состояния), передай `reload: true`.
 */
export function navigateToPath(path: string, options: { reload?: boolean } = {}): void {
  window.location.assign(appHref(path));
  const mode = env.VUE_ROUTER_MODE || process.env.VUE_ROUTER_MODE || 'hash';
  if (options.reload && mode !== 'history') {
    window.location.reload();
  }
}
