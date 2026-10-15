import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'

const rawGlobalSearchHitSelector = {
  key: true,
  title: true,
  subtitle: true,
  icon: true,
  route: {
    name: true,
    params: true,
    query: true,
  },
}

const rawGlobalSearchGroupSelector = {
  key: true,
  title: true,
  icon: true,
  extension_name: true,
  status: true,
  hits: rawGlobalSearchHitSelector,
}

// Проверка валидности
const _validate: MakeAllFieldsRequired<ValueTypes['GlobalSearchGroup']> = rawGlobalSearchGroupSelector
export type globalSearchGroupModel = ModelTypes['GlobalSearchGroup']

export const globalSearchGroupSelector = Selector('GlobalSearchGroup')(rawGlobalSearchGroupSelector)
export { rawGlobalSearchGroupSelector }
