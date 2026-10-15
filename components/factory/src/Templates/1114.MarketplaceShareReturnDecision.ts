import type { JSONSchemaType } from 'ajv'
import { Cooperative } from 'cooptypes'
import type { ITemplate } from '../Interfaces'
import { IMetaJSONSchema } from '../Schema/MetaSchema'
import { CooperativeSchema, VarsSchema, decisionSchema } from '../Schema'
import { CommonRequestSchema } from '../Schema/CommonRequestSchema'
import { CommonUserSchema } from '../Schema/CommonUserSchema'
import { CommonProgramSchema } from '../Schema/CommonProgramSchema'

export const registry_id = Cooperative.Registry.MarketplaceShareReturnDecision.registry_id

export type Action = Cooperative.Registry.MarketplaceShareReturnDecision.Action

export type Model = Cooperative.Registry.MarketplaceShareReturnDecision.Model

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
  title: Cooperative.Registry.MarketplaceShareReturnDecision.title,
  description: Cooperative.Registry.MarketplaceShareReturnDecision.description,
  model: Schema,
  context: Cooperative.Registry.MarketplaceShareReturnDecision.context,
  translations: Cooperative.Registry.MarketplaceShareReturnDecision.translations,
}
