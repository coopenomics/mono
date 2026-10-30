import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'

/** Паевой взнос пайщика в программу Благороста — запись истории «Мои взносы». */
const rawContributionSelector = {
  id: true,
  kind: true,
  amount: true,
  created_at: true,
  process_hash: true,
  memo: true,
}

// Проверка валидности
const _validate: MakeAllFieldsRequired<ValueTypes['CapitalContribution']> = rawContributionSelector

export type contributionModel = ModelTypes['CapitalContribution']

export const contributionSelector = Selector('CapitalContribution')(rawContributionSelector)
export { rawContributionSelector }
