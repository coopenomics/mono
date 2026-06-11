import type { JSONSchemaType } from 'ajv'
import { Cooperative } from 'cooptypes'
import type { ITemplate } from '../Interfaces'
import { IMetaJSONSchema } from '../Schema/MetaSchema'
import { CommonUserSchema, CooperativeSchema, VarsSchema } from '../Schema'

export const registry_id = Cooperative.Registry.BranchLiabilityAgreement.registry_id

// Модель действия для генерации
export type Action = Cooperative.Registry.BranchLiabilityAgreement.Action

// Модель данных
export type Model = Cooperative.Registry.BranchLiabilityAgreement.Model

// Схема для сверки
export const Schema: JSONSchemaType<Model> = {
  type: 'object',
  properties: {
    meta: IMetaJSONSchema,
    coop: CooperativeSchema,
    user: CommonUserSchema,
    braname: { type: 'string' },
    chairman_full_name: { type: 'string' },
    vars: VarsSchema,
  },
  required: ['meta', 'coop', 'user', 'braname', 'chairman_full_name', 'vars'],
  additionalProperties: true,
}

export const Template: ITemplate<Model> = {
  title: Cooperative.Registry.BranchLiabilityAgreement.title,
  description: Cooperative.Registry.BranchLiabilityAgreement.description,
  model: Schema,
  context: Cooperative.Registry.BranchLiabilityAgreement.context,
  translations: Cooperative.Registry.BranchLiabilityAgreement.translations,
}
