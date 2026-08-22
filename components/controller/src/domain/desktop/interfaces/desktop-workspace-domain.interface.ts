export interface DesktopWorkspaceDomainInterface {
  name: string; // уникальное имя workspace (например: 'soviet', 'chairman')
  title: string; // отображаемое название (например: 'Стол Совета')
  extension_name: string; // имя расширения, которому принадлежит этот workspace
  icon?: string; // иконка для меню
  defaultRoute?: string; // маршрут по умолчанию для этого workspace
  // Канон авторизации столов: плоский набор capability текущего пользователя
  // в расширении (`Resource:action`, уже развёрнутый `:all`→подмножества).
  // undefined — расширение не использует канон (фронт на legacy `meta.roles`).
  grants?: string[];
}
