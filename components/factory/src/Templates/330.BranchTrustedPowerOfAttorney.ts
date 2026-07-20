import type { JSONSchemaType } from 'ajv'
import { Cooperative } from 'cooptypes'
import type { ITemplate } from '../Interfaces'
import { IMetaJSONSchema } from '../Schema/MetaSchema'
import { individualSchema } from '../Schema/IndividualSchema'
import { CooperativeSchema, VarsSchema } from '../Schema'

export const registry_id = Cooperative.Registry.BranchTrustedPowerOfAttorney.registry_id

// Модель действия для генерации
export type Action = Cooperative.Registry.BranchTrustedPowerOfAttorney.Action

// Модель данных
export type Model = Cooperative.Registry.BranchTrustedPowerOfAttorney.Model

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
    trustee_full_name: { type: 'string' },
    vars: VarsSchema,
  },
  required: ['meta', 'coop', 'individual', 'branch_name', 'trustee_full_name', 'vars'],
  additionalProperties: true,
}

export const Template: ITemplate<Model> = {
  title: Cooperative.Registry.BranchTrustedPowerOfAttorney.title,
  description: Cooperative.Registry.BranchTrustedPowerOfAttorney.description,
  model: Schema,
  context: Cooperative.Registry.BranchTrustedPowerOfAttorney.context,
  translations: Cooperative.Registry.BranchTrustedPowerOfAttorney.translations,
}
