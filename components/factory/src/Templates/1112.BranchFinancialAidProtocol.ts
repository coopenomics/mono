import type { JSONSchemaType } from 'ajv'
import { Cooperative } from 'cooptypes'
import type { ITemplate } from '../Interfaces'
import { IMetaJSONSchema } from '../Schema/MetaSchema'
import { CommonUserSchema, CooperativeSchema } from '../Schema'
import { VarsSchema } from '../Schema/VarsSchema'
import { decisionSchema } from '../Schema/DecisionSchema'

export const registry_id = Cooperative.Registry.BranchFinancialAidProtocol.registry_id

export type Action = Cooperative.Registry.BranchFinancialAidProtocol.Action

export type Model = Cooperative.Registry.BranchFinancialAidProtocol.Model

export const Schema: JSONSchemaType<Model> = {
  type: 'object',
  properties: {
    meta: IMetaJSONSchema,
    coop: CooperativeSchema,
    vars: VarsSchema,
    decision: decisionSchema,
    aid_hash: { type: 'string' },
    receiver: CommonUserSchema,
    braname: { type: 'string' },
    amount: { type: 'string' },
  },
  required: ['meta', 'coop', 'vars', 'decision', 'aid_hash', 'receiver', 'braname', 'amount'],
  additionalProperties: true,
}

export const Template: ITemplate<Model> = {
  title: Cooperative.Registry.BranchFinancialAidProtocol.title,
  description: Cooperative.Registry.BranchFinancialAidProtocol.description,
  model: Schema,
  context: Cooperative.Registry.BranchFinancialAidProtocol.context,
  translations: Cooperative.Registry.BranchFinancialAidProtocol.translations,
}
