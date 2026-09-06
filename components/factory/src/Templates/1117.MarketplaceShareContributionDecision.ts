import type { JSONSchemaType } from 'ajv'
import { Cooperative } from 'cooptypes'
import type { ITemplate } from '../Interfaces'
import { IMetaJSONSchema } from '../Schema/MetaSchema'
import { CooperativeSchema, VarsSchema, decisionSchema } from '../Schema'
import { CommonRequestSchema } from '../Schema/CommonRequestSchema'
import { CommonUserSchema } from '../Schema/CommonUserSchema'
import { CommonProgramSchema } from '../Schema/CommonProgramSchema'

export const registry_id = Cooperative.Registry.MarketplaceShareContributionDecision.registry_id

export type Action = Cooperative.Registry.MarketplaceShareContributionDecision.Action

export type Model = Cooperative.Registry.MarketplaceShareContributionDecision.Model

export const Schema: JSONSchemaType<Model> = {
  type: 'object',
  properties: {
    meta: IMetaJSONSchema,
    coop: CooperativeSchema,
    vars: VarsSchema,
    request: CommonRequestSchema,
    user: CommonUserSchema,
    decision: decisionSchema,
    program: CommonProgramSchema,
  },
  required: ['meta', 'coop', 'vars', 'request', 'user', 'decision', 'program'],
  additionalProperties: true,
}

export const Template: ITemplate<Model> = {
  title: Cooperative.Registry.MarketplaceShareContributionDecision.title,
  description: Cooperative.Registry.MarketplaceShareContributionDecision.description,
  model: Schema,
  context: Cooperative.Registry.MarketplaceShareContributionDecision.context,
  translations: Cooperative.Registry.MarketplaceShareContributionDecision.translations,
}
