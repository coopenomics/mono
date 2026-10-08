import type { JSONSchemaType } from 'ajv'
import { Cooperative } from 'cooptypes'
import type { ITemplate } from '../Interfaces'
import { CooperativeSchema } from '../Schema'
import { IMetaJSONSchema } from '../Schema/MetaSchema'
import { VarsSchema } from '../Schema/VarsSchema'
import { CommonUserSchema } from '../Schema/CommonUserSchema'

export const registry_id = Cooperative.Registry.GetLoanStatement.registry_id

// Модель действия для генерации
export type Action = Cooperative.Registry.GetLoanStatement.Action

// Модель данных
export type Model = Cooperative.Registry.GetLoanStatement.Model

// Схема для сверки
export const Schema: JSONSchemaType<Model> = {
  type: 'object',
  properties: {
    meta: IMetaJSONSchema,
    coop: CooperativeSchema,
    vars: VarsSchema,
    user: CommonUserSchema,
    short_hash: { type: 'string' },
    basis_title_dative: { type: 'string' },
    basis_title_genitive: { type: 'string' },
    basis_title_instrumental: { type: 'string' },
    basis_number: { type: 'string' },
    basis_date: { type: 'string' },
    amount_digits: { type: 'string' },
    due_at: { type: 'string' },
    payment_details: { type: 'string' },
    collateral_text: { type: 'string' },
  },
  required: ['meta', 'coop', 'vars', 'user', 'short_hash', 'basis_number', 'basis_date', 'amount_digits', 'due_at', 'payment_details', 'collateral_text'],
  additionalProperties: true,
}

export const Template: ITemplate<Model> = {
  title: Cooperative.Registry.GetLoanStatement.title,
  description: Cooperative.Registry.GetLoanStatement.description,
  model: Schema,
  context: Cooperative.Registry.GetLoanStatement.context,
  translations: Cooperative.Registry.GetLoanStatement.translations,
}
