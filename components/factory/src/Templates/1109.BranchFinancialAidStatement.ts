import type { JSONSchemaType } from 'ajv'
import { Cooperative } from 'cooptypes'
import type { ITemplate } from '../Interfaces'
import { IMetaJSONSchema } from '../Schema/MetaSchema'
import { CooperativeSchema } from '../Schema'
import { VarsSchema } from '../Schema/VarsSchema'
import { CommonUserSchema } from '../Schema/CommonUserSchema'

export const registry_id = Cooperative.Registry.BranchFinancialAidStatement.registry_id

export type Action = Cooperative.Registry.BranchFinancialAidStatement.Action

export type Model = Cooperative.Registry.BranchFinancialAidStatement.Model

export const Schema: JSONSchemaType<Model> = {
  type: 'object',
  properties: {
    meta: IMetaJSONSchema,
    coop: CooperativeSchema,
    vars: VarsSchema,
    user: CommonUserSchema,
    aid_hash: { type: 'string' },
    braname: { type: 'string' },
    amount: { type: 'string' },
  },
  required: ['meta', 'coop', 'vars', 'user', 'aid_hash', 'braname', 'amount'],
  additionalProperties: true,
}

export const Template: ITemplate<Model> = {
  title: Cooperative.Registry.BranchFinancialAidStatement.title,
  description: Cooperative.Registry.BranchFinancialAidStatement.description,
  model: Schema,
  context: Cooperative.Registry.BranchFinancialAidStatement.context,
  translations: Cooperative.Registry.BranchFinancialAidStatement.translations,
}
