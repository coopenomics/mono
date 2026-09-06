import type { JSONSchemaType } from 'ajv'
import { Cooperative } from 'cooptypes'
import type { ITemplate } from '../Interfaces'
import { IMetaJSONSchema } from '../Schema/MetaSchema'
import { CooperativeSchema, VarsSchema, organizationSchema } from '../Schema'
import { CommonUserSchema } from '../Schema/CommonUserSchema'
import { CommonRequestSchema } from '../Schema/CommonRequestSchema'
import { CommonProgramSchema } from '../Schema/CommonProgramSchema'

export const registry_id = Cooperative.Registry.MarketplaceShareContributionStatement.registry_id

export type Action = Cooperative.Registry.MarketplaceShareContributionStatement.Action

export type Model = Cooperative.Registry.MarketplaceShareContributionStatement.Model

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
  title: Cooperative.Registry.MarketplaceShareContributionStatement.title,
  description: Cooperative.Registry.MarketplaceShareContributionStatement.description,
  model: Schema,
  context: Cooperative.Registry.MarketplaceShareContributionStatement.context,
  translations: Cooperative.Registry.MarketplaceShareContributionStatement.translations,
}
