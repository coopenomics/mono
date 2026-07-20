import type { JSONSchemaType } from 'ajv'
import { Cooperative } from 'cooptypes'
import type { ITemplate } from '../Interfaces'
import { IMetaJSONSchema } from '../Schema/MetaSchema'
import {
  CommonUserSchema,
  CooperativeSchema,
  ExpenseProposalHeaderSchema,
  ExpenseRenderItemSchema,
  VarsSchema,
} from '../Schema'

export const registry_id = Cooperative.Registry.ExpenseProposalStatement.registry_id

export type Action = Cooperative.Registry.ExpenseProposalStatement.Action
export type Model = Cooperative.Registry.ExpenseProposalStatement.Model
export type PrivateData = Cooperative.Registry.ExpenseProposalStatement.PrivateData

export const Schema: JSONSchemaType<Model> = {
  type: 'object',
  properties: {
    meta: IMetaJSONSchema,
    coop: CooperativeSchema,
    user: CommonUserSchema,
    vars: VarsSchema,
    proposal_hash: { type: 'string' },
    proposal_short_hash: { type: 'string' },
    proposal: ExpenseProposalHeaderSchema,
    items: {
      type: 'array',
      items: ExpenseRenderItemSchema,
    },
  },
  required: ['meta', 'coop', 'user', 'vars', 'proposal_hash', 'proposal_short_hash', 'proposal', 'items'],
  additionalProperties: true,
}

export const Template: ITemplate<Model> = {
  title: Cooperative.Registry.ExpenseProposalStatement.title,
  description: Cooperative.Registry.ExpenseProposalStatement.description,
  model: Schema,
  context: Cooperative.Registry.ExpenseProposalStatement.context,
  translations: Cooperative.Registry.ExpenseProposalStatement.translations,
}
