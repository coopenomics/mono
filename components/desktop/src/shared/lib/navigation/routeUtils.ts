import { RouteLocationNormalizedLoaded } from 'vue-router'
import { t } from 'src/shared/i18n';

/**
 * Получает глубину текущего маршрута
 *
 * @param route Текущий маршрут
 * @returns Глубина маршрута (количество уровней вложенности)
 */
export function getRouteDepth(route: RouteLocationNormalizedLoaded): number {
  return route.matched?.length || 0
}

/**
 * Получает родительский маршрут для текущего маршрута
 *
 * @param route Текущий маршрут
 * @returns Родительский маршрут или null, если его нет
 */
export function getParentRoute(route: RouteLocationNormalizedLoaded) {
  const matched = route.matched || []
  if (matched.length < 2) {
    return null
  }

  return matched[matched.length - 2]
}

/**
 * Проверяет, есть ли у маршрута родительский маршрут
 *
 * @param route Текущий маршрут
 * @returns true, если у маршрута есть родитель, иначе false
 */
export function hasParentRoute(route: RouteLocationNormalizedLoaded): boolean {
  return getParentRoute(route) !== null
}

/**
 * Получает заголовок маршрута из его метаданных
 *
 * @param route Маршрут
 * @param defaultTitle Заголовок по умолчанию, если в маршруте не указан
 * @returns Заголовок маршрута
 */
export function getRouteTitle(route: RouteLocationNormalizedLoaded | null, defaultTitle = t('common.action.back')): string {
  if (!route || !route.meta || !route.meta.title) {
    return defaultTitle
  }

  return route.meta.title as string
}
