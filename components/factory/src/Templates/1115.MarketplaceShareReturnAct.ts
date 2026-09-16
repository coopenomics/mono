import type { JSONSchemaType } from 'ajv'
import { Cooperative } from 'cooptypes'
import type { ITemplate } from '../Interfaces'
import { IMetaJSONSchema } from '../Schema/MetaSchema'
import { CooperativeSchema, VarsSchema, decisionSchema, organizationSchema } from '../Schema'
import { CommonRequestSchema } from '../Schema/CommonRequestSchema'
import { CommonUserSchema } from '../Schema/CommonUserSchema'
import { FirstLastMiddleNameSchema } from '../Schema/FirstLastMiddleNameSchema'
import { CommonProgramSchema } from '../Schema/CommonProgramSchema'

export const registry_id = Cooperative.Registry.MarketplaceShareReturnAct.registry_id

export type Action = Cooperative.Registry.MarketplaceShareReturnAct.Action

export type Model = Cooperative.Registry.MarketplaceShareReturnAct.Model

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
  title: Cooperative.Registry.MarketplaceShareReturnAct.title,
  description: Cooperative.Registry.MarketplaceShareReturnAct.description,
  model: Schema,
  context: Cooperative.Registry.MarketplaceShareReturnAct.context,
  translations: Cooperative.Registry.MarketplaceShareReturnAct.translations,
}
