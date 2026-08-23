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
  // Страница-шлюз стола: единственное, что доступно пайщику, пока он не выполнил
  // условие входа в стол (подписать оферту ЦПП, выбрать пункт выдачи, подключить
  // ЦПП кооперативом). Признак объявляется рядом с `requires`, а не выводится из
  // порядка маршрутов: навигационный гард по нему уводит на шлюз вместо
  // «Недостаточно прав доступа», когда пайщик просит закрытую страницу этого же
  // стола. Шлюзов в столе может быть несколько (разным ролям — разный вход);
  // выбирается тот, чьё `requires` выдано бэкендом.
  //
  // Ставится, только если выполнены ОБА условия, иначе гард начнёт уводить на
  // шлюз вместо честного отказа:
  //  1. `requires` шлюза — маркер незавершённого допуска, который бэкенд
  //     ПЕРЕСТАЁТ выдавать после прохождения (`Onboarding:orderer`,
  //     `Onboarding:offerer`), а не постоянное право роли;
  //  2. страница сама снимает своё условие — иначе пайщик попадёт в тупик.
  gate?: boolean
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
