import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { Selector, type ValueTypes } from '../../zeus/index'

export const rawCoopAgreementSelector = {
  type: true,
  coopname: true,
  program_id: true,
  draft_id: true,
}

const _validate: MakeAllFieldsRequired<ValueTypes['CoopAgreement']> = rawCoopAgreementSelector

export const coopAgreementSelector = Selector('CoopAgreement')(rawCoopAgreementSelector)
