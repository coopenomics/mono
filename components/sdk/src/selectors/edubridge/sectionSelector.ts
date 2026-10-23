import { Selector, type ValueTypes } from '../../zeus/index'
import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'

const rawLevelSelector = { id: true, section_id: true, title: true, sort_order: true, archived: true }
const _validateLevel: MakeAllFieldsRequired<ValueTypes['EduLevel']> = rawLevelSelector
export const eduLevelSelector = Selector('EduLevel')(rawLevelSelector)

const rawSectionSelector = { id: true, title: true, sort_order: true, archived: true, levels: rawLevelSelector }
const _validateSection: MakeAllFieldsRequired<ValueTypes['EduSection']> = rawSectionSelector
export const eduSectionSelector = Selector('EduSection')(rawSectionSelector)
