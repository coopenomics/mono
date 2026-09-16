import type { JSONSchemaType } from 'ajv'
import { Cooperative } from 'cooptypes'
import type { ITemplate } from '../Interfaces'
import { IMetaJSONSchema } from '../Schema/MetaSchema'
import { CooperativeSchema, VarsSchema, organizationSchema } from '../Schema'
import { CommonUserSchema } from '../Schema/CommonUserSchema'
import { CommonRequestSchema } from '../Schema/CommonRequestSchema'
import { CommonProgramSchema } from '../Schema/CommonProgramSchema'

export const registry_id = Cooperative.Registry.MarketplaceReturnCancelStatement.registry_id

export type Action = Cooperative.Registry.MarketplaceReturnCancelStatement.Action

export type Model = Cooperative.Registry.MarketplaceReturnCancelStatement.Model

export const Schema: JSONSchemaType<Model> = {
  type: 'object',
  properties: {
    meta: IMetaJSONSchema,
    coop: CooperativeSchema,
    vars: VarsSchema,
    user: CommonUserSchema,
    orderer: CommonUserSchema,
    request: CommonRequestSchema,
    program: CommonProgramSchema,
    branch: { ...organizationSchema, nullable: true },
    fact_cost: { type: 'string' },
    fee_refund: { type: 'string' },
    total_refund: { type: 'string' },
    actual_quantity: { type: 'string' },
    reason_text: { type: 'string' },
    inspection_result: { type: 'string' },
    order_hash: { type: 'string' },
    request_hash: { type: 'string' },
    issue_decision_id: { type: 'string' },
  },
  required: [
    'meta', 'coop', 'vars', 'user', 'orderer', 'request', 'program',
    'fact_cost', 'fee_refund', 'total_refund', 'actual_quantity',
    'reason_text', 'inspection_result', 'order_hash', 'request_hash', 'issue_decision_id',
  ],
  additionalProperties: true,
}

export const Template: ITemplate<Model> = {
  title: Cooperative.Registry.MarketplaceReturnCancelStatement.title,
  description: Cooperative.Registry.MarketplaceReturnCancelStatement.description,
  model: Schema,
  context: Cooperative.Registry.MarketplaceReturnCancelStatement.context,
  translations: Cooperative.Registry.MarketplaceReturnCancelStatement.translations,
}
