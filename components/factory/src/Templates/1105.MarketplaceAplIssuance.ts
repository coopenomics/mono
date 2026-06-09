import type { JSONSchemaType } from 'ajv'
import { Cooperative } from 'cooptypes'
import type { ITemplate } from '../Interfaces'
import { IMetaJSONSchema } from '../Schema/MetaSchema'
import { CooperativeSchema, VarsSchema, decisionSchema, organizationSchema } from '../Schema'
import { CommonRequestSchema } from '../Schema/CommonRequestSchema'
import { CommonUserSchema } from '../Schema/CommonUserSchema'
import { FirstLastMiddleNameSchema } from '../Schema/FirstLastMiddleNameSchema'
import { CommonProgramSchema } from '../Schema/CommonProgramSchema'

export const registry_id = Cooperative.Registry.MarketplaceAplIssuance.registry_id

export type Action = Cooperative.Registry.MarketplaceAplIssuance.Action

export type Model = Cooperative.Registry.MarketplaceAplIssuance.Model

export const Schema: JSONSchemaType<Model> = {
  type: 'object',
  properties: {
    meta: IMetaJSONSchema,
    coop: CooperativeSchema,
    vars: VarsSchema,
    request: CommonRequestSchema,
    user: CommonUserSchema,
    decision: decisionSchema,
    act_id: { type: 'string' },
    transmitter: FirstLastMiddleNameSchema,
    program: CommonProgramSchema,
    branch: { ...organizationSchema, nullable: true },
  },
  required: ['meta', 'coop', 'vars', 'request', 'user', 'decision', 'act_id', 'transmitter', 'program'],
  additionalProperties: true,
}

export const Template: ITemplate<Model> = {
  title: Cooperative.Registry.MarketplaceAplIssuance.title,
  description: Cooperative.Registry.MarketplaceAplIssuance.description,
  model: Schema,
  context: Cooperative.Registry.MarketplaceAplIssuance.context,
  translations: Cooperative.Registry.MarketplaceAplIssuance.translations,
}
