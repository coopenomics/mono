/**
 * Канон авторизации столов/страниц (grants) — порт расширения.
 *
 * Единый источник истины «кто что видит» — backend. Каждое desktop-расширение
 * МОЖЕТ опубликовать провайдер грантов: по текущему пользователю он возвращает
 * плоский набор capability-строк (`Resource:action`), которыми пайщик обладает
 * в этом расширении. `getDesktop` прикрепляет этот набор к каждому workspace
 * расширения (`DesktopWorkspace.grants`), а фронт лишь сверяет `meta.requires`
 * маршрута с выданными грантами (plain includes) — без собственной policy.
 *
 * Расширения БЕЗ провайдера работают по-старому: `grants` не приходит
 * (undefined), фронт падает на legacy-видимость по `meta.roles`. Канон
 * опционален и не ломает существующие приложения (capital/soviet/participant…).
 *
 * Гранты разворачивает САМ провайдер: право `<base>:all` обязано развернуться
 * в подмножества (`:own`/`:own-KU`/`:to-self`), чтобы фронту хватало plain
 * `includes`, а вся иерархия охвата осталась на backend (см.
 * marketplace `expandGrantsForRoles`). Так фронт не реплицирует canAccess.
 */

export const EXTENSION_GRANTS_REGISTRY = Symbol('EXTENSION_GRANTS_REGISTRY');

/**
 * Сам контракт провайдера живёт в секции хуков `@coopenomics/innercoop`:
 * реализует его расширение, вызывает ядро. Здесь он доступен под привычными
 * ядру именами.
 */
export type {
  IDesktopGrantsHook as IExtensionDesktopGrantsProvider,
  InnerDesktopGrantsContext as IDesktopGrantsContext,
} from '@coopenomics/innercoop';
