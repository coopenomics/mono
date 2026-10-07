import type { JSONSchemaType } from 'ajv'
import { Cooperative } from 'cooptypes'
import type { ITemplate } from '../Interfaces'
import { CooperativeSchema } from '../Schema'
import { IMetaJSONSchema } from '../Schema/MetaSchema'
import { VarsSchema } from '../Schema/VarsSchema'
import { CommonUserSchema } from '../Schema/CommonUserSchema'
import { decisionSchema } from '../Schema/DecisionSchema'

export const registry_id = Cooperative.Registry.GetLoanDecision.registry_id

// Модель действия для генерации
export type Action = Cooperative.Registry.GetLoanDecision.Action

// Модель данных
export type Model = Cooperative.Registry.GetLoanDecision.Model

// Схема для сверки
export const Schema: JSONSchemaType<Model> = {
  type: 'object',
  properties: {
    meta: IMetaJSONSchema,
    coop: CooperativeSchema,
    vars: VarsSchema,
    decision: decisionSchema,
    common_user: CommonUserSchema,
    short_hash: { type: 'string' },
    basis_title_instrumental: { type: 'string' },
    basis_number: { type: 'string' },
    basis_date: { type: 'string' },
    amount_digits: { type: 'string' },
    amount_words: { type: 'string' },
    due_at: { type: 'string' },
    collateral_text: { type: 'string' },
  },
  required: ['meta', 'coop', 'vars', 'decision', 'common_user', 'short_hash', 'basis_number', 'basis_date', 'amount_digits', 'amount_words', 'due_at', 'collateral_text'],
  additionalProperties: true,
}

export const Template: ITemplate<Model> = {
  title: Cooperative.Registry.GetLoanDecision.title,
  description: Cooperative.Registry.GetLoanDecision.description,
  model: Schema,
  context: Cooperative.Registry.GetLoanDecision.context,
  translations: Cooperative.Registry.GetLoanDecision.translations,
}
