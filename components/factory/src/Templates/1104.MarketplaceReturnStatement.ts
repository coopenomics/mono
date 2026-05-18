import type { JSONSchemaType } from 'ajv'
import { Cooperative } from 'cooptypes'
import type { ITemplate } from '../Interfaces'
import { IMetaJSONSchema } from '../Schema/MetaSchema'
import { CooperativeSchema, VarsSchema, organizationSchema } from '../Schema'
import { CommonUserSchema } from '../Schema/CommonUserSchema'
import { CommonRequestSchema } from '../Schema/CommonRequestSchema'
import { CommonProgramSchema } from '../Schema/CommonProgramSchema'

export const registry_id = Cooperative.Registry.MarketplaceReturnStatement.registry_id

export type Action = Cooperative.Registry.MarketplaceReturnStatement.Action

export type Model = Cooperative.Registry.MarketplaceReturnStatement.Model

export const Schema: JSONSchemaType<Model> = {
  type: 'object',
  properties: {
    meta: IMetaJSONSchema,
    coop: CooperativeSchema,
    vars: VarsSchema,
    request: CommonRequestSchema,
    user: CommonUserSchema,
    program: CommonProgramSchema,
    fact_cost: { type: 'string' },
    actual_quantity: { type: 'string' },
    reason_text: { type: 'string' },
    defect_category: { type: 'string', nullable: true },
    branch: { ...organizationSchema, nullable: true },
  },
  required: ['meta', 'coop', 'vars', 'request', 'user', 'program', 'fact_cost', 'actual_quantity', 'reason_text'],
  additionalProperties: true,
}

export const Template: ITemplate<Model> = {
  title: Cooperative.Registry.MarketplaceReturnStatement.title,
  description: Cooperative.Registry.MarketplaceReturnStatement.description,
  model: Schema,
  context: Cooperative.Registry.MarketplaceReturnStatement.context,
  translations: Cooperative.Registry.MarketplaceReturnStatement.translations,
}
