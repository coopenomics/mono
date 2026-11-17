import { type MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'

/** Содержание процесса для стола бухгалтера: предмет, стороны, суммы, состояние. */
const rawProcessContentSelector = {
  title: true,
  subtitle: true,
  image_url: true,
  amount: true,
  amount_label: true,
  status: true,
  facts: { label: true, value: true },
  links: { label: true, path: true },
}

const _validate: MakeAllFieldsRequired<ValueTypes['ProcessContent']> = rawProcessContentSelector

export type processContentModel = ModelTypes['ProcessContent']
export const processContentSelector = Selector('ProcessContent')(rawProcessContentSelector)
