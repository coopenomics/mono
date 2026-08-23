import type { JSONSchemaType } from 'ajv'
import { Cooperative } from 'cooptypes'
import type { ITemplate } from '../Interfaces'
import { IMetaJSONSchema } from '../Schema/MetaSchema'
import { CooperativeSchema, VarsSchema, decisionSchema } from '../Schema'

export const registry_id = Cooperative.Registry.BranchEstablishmentSovietDecision.registry_id

// Модель действия для генерации
export type Action = Cooperative.Registry.BranchEstablishmentSovietDecision.Action

// Модель данных
export type Model = Cooperative.Registry.BranchEstablishmentSovietDecision.Model

// Схема для сверки
export const Schema: JSONSchemaType<Model> = {
  type: 'object',
  properties: {
    meta: IMetaJSONSchema,
    coop: CooperativeSchema,
    decision: decisionSchema,
    branch_name: { type: 'string' },
    address: { type: 'string' },
    chairman_full_name: { type: 'string' },
    vars: VarsSchema,
  },
  required: ['meta', 'coop', 'decision', 'branch_name', 'address', 'chairman_full_name', 'vars'],
  additionalProperties: true,
}

export const Template: ITemplate<Model> = {
  title: Cooperative.Registry.BranchEstablishmentSovietDecision.title,
  description: Cooperative.Registry.BranchEstablishmentSovietDecision.description,
  model: Schema,
  context: Cooperative.Registry.BranchEstablishmentSovietDecision.context,
  translations: Cooperative.Registry.BranchEstablishmentSovietDecision.translations,
}
