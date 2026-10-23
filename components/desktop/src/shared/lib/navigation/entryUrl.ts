import { env } from 'src/shared/config';

export type RouterMode = 'hash' | 'history';

/**
 * Фактический режим роутера. ЕДИНЫЙ источник для всех, кто строит или разбирает
 * ссылки: `router.ts` (какую history создать), `appHref` (как собрать href) и
 * `normalizeEntryUrl` (как починить входящий адрес). Раньше каждый читал
 * переменную по-своему, и при пустом `window.__APP_CONFIG__.VUE_ROUTER_MODE`
 * роутер уходил в hash, а конвертер ссылок считал режим history.
 */
export function resolveRouterMode(): RouterMode {
  const mode = env.VUE_ROUTER_MODE || process.env.VUE_ROUTER_MODE;
  return mode === 'history' ? 'history' : 'hash';
}

/** Адрес приложения, разобранный на части (то же, что даёт `window.location`). */
export interface EntryLocation {
  pathname: string;
  search: string;
  hash: string;
}

function isRootPath(pathname: string): boolean {
  const base = (env.VUE_ROUTER_BASE || '/').replace(/\/+$/, '');
  const path = pathname.replace(/\/+$/, '');
  return path === base || path === `${base}/index.html`;
}

/**
 * Каким должен стать адрес, чтобы роутер увидел в нём маршрут. `null` — адрес
 * уже канонический, трогать не надо.
 *
 * Платформа живёт в двух режимах сразу: прод (SSR) — history, dev (SPA) — hash,
 * а ссылки ходят между ними обеими формами: секретарь публикует в чат стола
 * связи `…/#/voskhod/capital/…`, письма и SSR строят `…/voskhod/capital/…`.
 * Функция сводит любую из форм к той, которую понимает текущий роутер:
 *
 * — history + `/#/путь`: маршрут спрятан в хэше, роутер видит `/` и уводит
 *   гардом на дефолтный стол (маршрут `index`). Переносим хэш в path.
 * — hash + `/путь` без хэша: маршрут в pathname, hash-роутер видит пустой `#`
 *   и открывает главную. Переносим path в хэш.
 *
 * Чистая функция: ничего не читает из `window` и не трогает историю — так её
 * поведение можно проверить на любых входных данных.
 */
export function nextEntryUrl(mode: RouterMode, loc: EntryLocation): string | null {
  if (mode === 'history') {
    // Хэш-маршрут узнаём по `#/`: `#section` — это якорь, а не адрес.
    if (!loc.hash.startsWith('#/')) return null;
    // Путь уже задан (`/voskhod/x#/y`) — хэш не наш, не вмешиваемся.
    if (!isRootPath(loc.pathname)) return null;

    const inner = loc.hash.slice(1);
    // Query у внешнего адреса (`/?utm=…#/путь`) сохраняем, если внутри хэша
    // своего нет: иначе метки перехода терялись бы на первом же редиректе.
    const hasInnerQuery = inner.includes('?');
    return hasInnerQuery || !loc.search ? inner : `${inner}${loc.search}`;
  }

  if (isRootPath(loc.pathname)) return null;
  // Маршрут уже в хэше — pathname тогда просто база, чинить нечего.
  if (loc.hash.startsWith('#/')) return null;

  return `${(env.VUE_ROUTER_BASE || '/').replace(/\/+$/, '')}/#${loc.pathname}${loc.search}`;
}

/**
 * Привести адрес страницы к режиму роутера ДО того, как роутер прочитает
 * `location`. Вызывается из `src/app/providers/router.ts` перед `createRouter`:
 * позже уже поздно — на `/#/путь` в history-режиме роутер сматчит `/`, гард
 * навигации уведёт на дефолтный стол, и правка адреса ничего не вернёт.
 *
 * Правим через `replaceState`, а не `location.replace`: перезагрузка на SSR
 * означала бы второй заход на сервер и лишний холодный старт.
 */
export function normalizeEntryUrl(): void {
  if (typeof window === 'undefined' || process.env.SERVER === 'true') return;

  const { pathname, search, hash } = window.location;
  const next = nextEntryUrl(resolveRouterMode(), { pathname, search, hash });
  if (!next) return;

  window.history.replaceState(window.history.state, '', next);
}
