import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'

const rawAssignableRoleSelector = {
  key: true,
  title: true,
  description: true,
  extension_name: true,
  extension_title: true,
  assignments: {
    username: true,
    display_name: true,
    assigned_by: true,
    assigned_at: true,
  },
}

// Проверка валидности
const _validate: MakeAllFieldsRequired<ValueTypes['AssignableRole']> = rawAssignableRoleSelector

export type assignableRoleModel = ModelTypes['AssignableRole']
export const assignableRoleSelector = Selector('AssignableRole')(rawAssignableRoleSelector)
export { rawAssignableRoleSelector }
