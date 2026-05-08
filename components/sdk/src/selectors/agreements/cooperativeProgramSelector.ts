import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { Selector, type ValueTypes } from '../../zeus/index'

export const rawCooperativeProgramSelector = {
  id: true,
  coopname: true,
  program_type: true,
  is_active: true,
  draft_id: true,
}

const _validate: MakeAllFieldsRequired<ValueTypes['CooperativeProgram']> = rawCooperativeProgramSelector

export const cooperativeProgramSelector = Selector('CooperativeProgram')(rawCooperativeProgramSelector)
