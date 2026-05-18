import { Selector, type ValueTypes } from '../../zeus/index'
import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'

const rawActionSelector = {
  id: true,
  account: true,
  name: true,
  data: true,
  block_num: true,
  block_id: true,
  global_sequence: true,
  transaction_id: true,
  created_at: true,
}

const _validateAction: MakeAllFieldsRequired<ValueTypes['ProcessAction']> = rawActionSelector

const rawDeltaSelector = {
  id: true,
  code: true,
  scope: true,
  table: true,
  primary_key: true,
  present: true,
  value: true,
  block_num: true,
  created_at: true,
}

const _validateDelta: MakeAllFieldsRequired<ValueTypes['ProcessDelta']> = rawDeltaSelector

const rawDocumentSourceSelector = {
  code: true,
  table: true,
  field: true,
  primary_key: true,
}

const _validateDocSource: MakeAllFieldsRequired<ValueTypes['ProcessDocumentSource']> =
  rawDocumentSourceSelector

const rawDocumentSelector = {
  hash: true,
  source: rawDocumentSourceSelector,
  document: true,
  raw: true,
}

const _validateDoc: MakeAllFieldsRequired<ValueTypes['ProcessDocument']> = rawDocumentSelector

const rawProcessViewSelector = {
  process_type: true,
  process_hash: true,
  coopname: true,
  first_seen_at: true,
  last_seen_at: true,
  actions: rawActionSelector,
  delta_history: rawDeltaSelector,
  documents: rawDocumentSelector,
}

const _validateView: MakeAllFieldsRequired<ValueTypes['ProcessView']> = rawProcessViewSelector

export const processViewSelector = Selector('ProcessView')(rawProcessViewSelector)
