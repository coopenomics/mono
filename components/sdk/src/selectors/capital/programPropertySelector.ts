import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'
import { rawDocumentAggregateSelector } from '../documents/documentAggregateSelector'
import { baseCapitalSelector } from './baseCapitalSelector'

/** Паевой взнос имуществом в «Благорост» с документами процесса. */
const rawProgramPropertySelector = {
  ...baseCapitalSelector,
  id: true,
  status: true,
  property_hash: true,
  coopname: true,
  username: true,
  blockchain_status: true,
  property_amount: true,
  property_description: true,
  property_name: true,
  property_details: true,
  property_quantity: true,
  property_unit: true,
  created_at: true,
  statement: rawDocumentAggregateSelector,
  authorization: rawDocumentAggregateSelector,
  act: rawDocumentAggregateSelector,
}

// Проверка валидности
const _validate: MakeAllFieldsRequired<ValueTypes['CapitalProgramProperty']> = rawProgramPropertySelector

export type programPropertyModel = ModelTypes['CapitalProgramProperty']

export const programPropertySelector = Selector('CapitalProgramProperty')(rawProgramPropertySelector)
export { rawProgramPropertySelector }
