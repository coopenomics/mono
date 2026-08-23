import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'

const rawWorkspaceSelector = {
  extension_name: true,
  name: true,
  title: true,
  icon: true,
  defaultRoute: true,
  // Канон авторизации столов: права текущего пользователя в расширении.
  // Поле появляется в Zeus-типах после generate-schema + generate-client.
  grants: true,
}

// Проверка валидности
const _validate: MakeAllFieldsRequired<ValueTypes['DesktopWorkspace']> = rawWorkspaceSelector
export type workspaceModel = ModelTypes['DesktopWorkspace']

export const workspaceSelector = Selector('DesktopWorkspace')(rawWorkspaceSelector)
export { rawWorkspaceSelector }
