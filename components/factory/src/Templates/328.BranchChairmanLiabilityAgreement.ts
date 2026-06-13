import type { JSONSchemaType } from 'ajv'
import { Cooperative } from 'cooptypes'
import type { ITemplate } from '../Interfaces'
import { IMetaJSONSchema } from '../Schema/MetaSchema'
import { individualSchema } from '../Schema/IndividualSchema'
import { CooperativeSchema, VarsSchema } from '../Schema'

export const registry_id = Cooperative.Registry.BranchChairmanLiabilityAgreement.registry_id

// Модель действия для генерации
export type Action = Cooperative.Registry.BranchChairmanLiabilityAgreement.Action

// Модель данных
export type Model = Cooperative.Registry.BranchChairmanLiabilityAgreement.Model

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
  title: Cooperative.Registry.BranchChairmanLiabilityAgreement.title,
  description: Cooperative.Registry.BranchChairmanLiabilityAgreement.description,
  model: Schema,
  context: Cooperative.Registry.BranchChairmanLiabilityAgreement.context,
  translations: Cooperative.Registry.BranchChairmanLiabilityAgreement.translations,
}
