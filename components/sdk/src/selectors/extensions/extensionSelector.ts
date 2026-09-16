import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'

const rawDesktopSelector = {
  name: true,
  title: true,
  icon: true,
  defaultRoute: true
}

const rawExtensionSelector = {
  name: true,
  is_available: true,
  is_installed: true,
  desktops: rawDesktopSelector,
  external_url: true,
  is_internal: true,
  enabled: true,
  updated_at: true,
  created_at: true,
  config: true,
  schema: true,
  title: true,
  description: true,
  image: true,
  tags: true,
  readme: true,
  instructions: true,
}

// Проверка валидности
const _validate: MakeAllFieldsRequired<ValueTypes['Extension']> = rawExtensionSelector
export type extensionModel = ModelTypes['Extension']

export const extensionSelector = Selector('Extension')(rawExtensionSelector)
export { rawExtensionSelector }
