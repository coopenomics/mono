import type { JSONSchemaType } from 'ajv'
import { Cooperative } from 'cooptypes'
import type { ITemplate } from '../Interfaces'
import { IMetaJSONSchema } from '../Schema/MetaSchema'
import { individualSchema } from '../Schema/IndividualSchema'
import { CooperativeSchema, VarsSchema } from '../Schema'

export const registry_id = Cooperative.Registry.BranchTrusteeLiabilityAgreement.registry_id

// Модель действия для генерации
export type Action = Cooperative.Registry.BranchTrusteeLiabilityAgreement.Action

// Модель данных
export type Model = Cooperative.Registry.BranchTrusteeLiabilityAgreement.Model

// Схема для сверки
export const Schema: JSONSchemaType<Model> = {
  type: 'object',
  properties: {
    meta: IMetaJSONSchema,
    coop: CooperativeSchema,
    individual: {
      type: 'object',
      properties: {
        ...individualSchema.properties,
      },
      required: [...individualSchema.required],
      additionalProperties: true,
    },
    branch_name: { type: 'string' },
    vars: VarsSchema,
  },
  required: ['meta', 'coop', 'individual', 'branch_name', 'vars'],
  additionalProperties: true,
}

export const Template: ITemplate<Model> = {
  title: Cooperative.Registry.BranchTrusteeLiabilityAgreement.title,
  description: Cooperative.Registry.BranchTrusteeLiabilityAgreement.description,
  model: Schema,
  context: Cooperative.Registry.BranchTrusteeLiabilityAgreement.context,
  translations: Cooperative.Registry.BranchTrusteeLiabilityAgreement.translations,
}
