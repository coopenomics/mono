import type { JSONSchemaType } from 'ajv'
import { Cooperative } from 'cooptypes'
import type { ITemplate } from '../Interfaces'
import { CooperativeSchema } from '../Schema'
import { IMetaJSONSchema } from '../Schema/MetaSchema'
import { VarsSchema } from '../Schema/VarsSchema'
import { CommonUserSchema } from '../Schema/CommonUserSchema'

export const registry_id = Cooperative.Registry.LoanRepaymentStatement.registry_id

// Модель действия для генерации
export type Action = Cooperative.Registry.LoanRepaymentStatement.Action

// Модель данных
export type Model = Cooperative.Registry.LoanRepaymentStatement.Model

// Схема для сверки
export const Schema: JSONSchemaType<Model> = {
  type: 'object',
  properties: {
    meta: IMetaJSONSchema,
    coop: CooperativeSchema,
    vars: VarsSchema,
    user: CommonUserSchema,
    short_hash: { type: 'string' },
    contract_date: { type: 'string' },
    amount_digits: { type: 'string' },
    amount_words: { type: 'string' },
  },
  required: ['meta', 'coop', 'vars', 'user', 'short_hash', 'contract_date', 'amount_digits', 'amount_words'],
  additionalProperties: true,
}

export const Template: ITemplate<Model> = {
  title: Cooperative.Registry.LoanRepaymentStatement.title,
  description: Cooperative.Registry.LoanRepaymentStatement.description,
  model: Schema,
  context: Cooperative.Registry.LoanRepaymentStatement.context,
  translations: Cooperative.Registry.LoanRepaymentStatement.translations,
}
