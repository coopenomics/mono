export interface IWorkspaceRouteMeta {
  title: string
  // Иконка пункта меню. Необязательна: hidden-роуты (deep-link страницы вроде
  // карточки документа) в навигацию не попадают и иконки не имеют. В drawer
  // рендер гардится `v-if='item.icon'`, undefined безопасен.
  icon?: string
  // Канон авторизации столов. `requires` — capability вида «Resource:action»;
  // страница/стол видны, если требование входит в grants стола (с бэкенда).
  // Расширения с grants объявляют `requires` на маршрутах вместо `roles`.
  // `roles` — legacy-механизм видимости по core-роли (chairman/member/user);
  // остаётся для расширений без grants. Подробнее: EXTENSIONS_SCHEMA_SYSTEM.md.
  requires?: string
  roles?: string[]
  agreements?: string[]
  conditions?: string
  action?: string // Имя действия вместо перехода на страницу
  hidden?: boolean
  [key: string]: any
}

export interface IWorkspaceRoute {
  path: string
  name: string
  component?: any
  meta?: IWorkspaceRouteMeta
  children?: IWorkspaceRoute[]
  [key: string]: any
}

export interface IWorkspaceConfig {
  workspace: string // Уникальное имя workspace (например: 'soviet', 'chairman')
  extension_name: string // Имя расширения, которому принадлежит этот workspace
  title?: string // Отображаемое название workspace
  icon?: string // Иконка для меню
  defaultRoute?: string // Имя маршрута для перехода по умолчанию
  routes: IWorkspaceRoute[]
}
