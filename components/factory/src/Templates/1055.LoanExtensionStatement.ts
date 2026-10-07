import type { JSONSchemaType } from 'ajv'
import { Cooperative } from 'cooptypes'
import type { ITemplate } from '../Interfaces'
import { CooperativeSchema } from '../Schema'
import { IMetaJSONSchema } from '../Schema/MetaSchema'
import { VarsSchema } from '../Schema/VarsSchema'
import { CommonUserSchema } from '../Schema/CommonUserSchema'

export const registry_id = Cooperative.Registry.LoanExtensionStatement.registry_id

// Модель действия для генерации
export type Action = Cooperative.Registry.LoanExtensionStatement.Action

// Модель данных
export type Model = Cooperative.Registry.LoanExtensionStatement.Model

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
    new_due_at: { type: 'string' },
    remaining_digits: { type: 'string' },
    remaining_words: { type: 'string' },
  },
  required: ['meta', 'coop', 'vars', 'user', 'short_hash', 'contract_date', 'new_due_at', 'remaining_digits', 'remaining_words'],
  additionalProperties: true,
}

export const Template: ITemplate<Model> = {
  title: Cooperative.Registry.LoanExtensionStatement.title,
  description: Cooperative.Registry.LoanExtensionStatement.description,
  model: Schema,
  context: Cooperative.Registry.LoanExtensionStatement.context,
  translations: Cooperative.Registry.LoanExtensionStatement.translations,
}
