import type { JSONSchemaType } from 'ajv'
import { Cooperative } from 'cooptypes'
import type { ITemplate } from '../Interfaces'
import { IMetaJSONSchema } from '../Schema/MetaSchema'
import { CooperativeSchema, VarsSchema } from '../Schema'
import { CommonUserSchema } from '../Schema/CommonUserSchema'

export const registry_id = Cooperative.Registry.CooperativeInvestStatement.registry_id

// Модель действия для генерации
export type Action = Cooperative.Registry.CooperativeInvestStatement.Action

// Модель данных
export type Model = Cooperative.Registry.CooperativeInvestStatement.Model

// Схема для сверки
export const Schema: JSONSchemaType<Model> = {
  type: 'object',
  properties: {
    meta: IMetaJSONSchema,
    coop: CooperativeSchema,
    vars: VarsSchema,
    user: CommonUserSchema,
    quantity: { type: 'string' },
    currency: { type: 'string' },
    payment_hash: { type: 'string' },
    target_coop_fullname: { type: 'string' },
    program_name: { type: 'string' },
    payment_details: { type: 'string' },
  },
  required: ['meta', 'coop', 'vars', 'user', 'quantity', 'currency', 'payment_hash', 'target_coop_fullname', 'program_name', 'payment_details'],
  additionalProperties: false,
}

export const Template: ITemplate<Model> = {
  title: Cooperative.Registry.CooperativeInvestStatement.title,
  description: Cooperative.Registry.CooperativeInvestStatement.description,
  model: Schema,
  context: Cooperative.Registry.CooperativeInvestStatement.context,
  translations: Cooperative.Registry.CooperativeInvestStatement.translations,
}
