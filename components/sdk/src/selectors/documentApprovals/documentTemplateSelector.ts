import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { Selector, type ValueTypes } from '../../zeus/index'

export const rawDocumentTemplateSelector = {
  registry_id: true,
  extension_name: true,
  kind: true,
  approval: true,
  bundle: true,
  title: true,
  order: true,
  current_version: true,
  approved_version: true,
  approved_decision_id: true,
  approved_at: true,
  effective_version: true,
  state: true,
  pending_hash: true,
}

const _validate: MakeAllFieldsRequired<ValueTypes['DocumentTemplate']> = rawDocumentTemplateSelector

export const documentTemplateSelector = Selector('DocumentTemplate')(rawDocumentTemplateSelector)

export const rawDocumentTemplateBlankSelector = {
  registry_id: true,
  title: true,
  html: true,
  text_hash: true,
}

const _validateBlank: MakeAllFieldsRequired<ValueTypes['DocumentTemplateBlank']> = rawDocumentTemplateBlankSelector

export const documentTemplateBlankSelector = Selector('DocumentTemplateBlank')(rawDocumentTemplateBlankSelector)
