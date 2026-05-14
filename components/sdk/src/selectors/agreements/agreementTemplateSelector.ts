import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { Selector, type ValueTypes } from '../../zeus/index'

export const rawAgreementTemplateSelector = {
  registry_id: true,
  version: true,
  default_translation_id: true,
  title: true,
  description: true,
  context: true,
  model: true,
}

const _validate: MakeAllFieldsRequired<ValueTypes['AgreementTemplate']> = rawAgreementTemplateSelector

export const agreementTemplateSelector = Selector('AgreementTemplate')(rawAgreementTemplateSelector)
