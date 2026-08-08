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

/** Контекст для вычисления грантов текущего пользователя. */
export interface IDesktopGrantsContext {
  coopname: string;
  /** username из JWT; undefined — неавторизованный гость. */
  username?: string;
  /** core-роль платформы из JWT (`user`/`member`/`chairman`/…). */
  userRole?: string;
  /** статус пайщика (`active` и т.п.) — для гейтов, требующих членства. */
  userStatus?: string;
  /** конфиг расширения (нужен для онбординг-гейтов: ЦПП принят и т.п.). */
  config?: any;
}

export interface IExtensionDesktopGrantsProvider {
  /** Имя расширения в AppRegistry (например, `market`). */
  readonly extensionName: string;
  /**
   * Вернуть плоский, уже развёрнутый (`:all`→подмножества) набор capability
   * текущего пользователя. Гость / нет членства → `[]`.
   */
  resolveGrants(ctx: IDesktopGrantsContext): Promise<string[]>;
}
