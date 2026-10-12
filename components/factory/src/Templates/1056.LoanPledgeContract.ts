import type { JSONSchemaType } from 'ajv'
import { Cooperative } from 'cooptypes'
import type { ITemplate } from '../Interfaces'
import { CooperativeSchema } from '../Schema'
import { IMetaJSONSchema } from '../Schema/MetaSchema'
import { VarsSchema } from '../Schema/VarsSchema'
import { CommonUserSchema } from '../Schema/CommonUserSchema'

export const registry_id = Cooperative.Registry.LoanPledgeContract.registry_id

// Модель действия для генерации
export type Action = Cooperative.Registry.LoanPledgeContract.Action

// Модель данных
export type Model = Cooperative.Registry.LoanPledgeContract.Model

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
    contract_date: { type: 'string' },
    party_identity: { type: 'string' },
    pledger_requisites: { type: 'string' },
  },
  required: ['meta', 'coop', 'vars', 'user', 'short_hash', 'basis_number', 'basis_date', 'amount_digits', 'due_at', 'contract_date', 'party_identity', 'pledger_requisites'],
  additionalProperties: true,
}

export const Template: ITemplate<Model> = {
  title: Cooperative.Registry.LoanPledgeContract.title,
  description: Cooperative.Registry.LoanPledgeContract.description,
  model: Schema,
  context: Cooperative.Registry.LoanPledgeContract.context,
  translations: Cooperative.Registry.LoanPledgeContract.translations,
}
