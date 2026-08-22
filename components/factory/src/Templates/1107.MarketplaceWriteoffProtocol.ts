import type { JSONSchemaType } from 'ajv'
import { Cooperative } from 'cooptypes'
import type { ITemplate } from '../Interfaces'
import { IMetaJSONSchema } from '../Schema/MetaSchema'
import { CooperativeSchema } from '../Schema'
import { VarsSchema } from '../Schema/VarsSchema'
import { decisionSchema } from '../Schema/DecisionSchema'

export const registry_id = Cooperative.Registry.MarketplaceWriteoffProtocol.registry_id

export type Action = Cooperative.Registry.MarketplaceWriteoffProtocol.Action

export type Model = Cooperative.Registry.MarketplaceWriteoffProtocol.Model

export const Schema: JSONSchemaType<Model> = {
  type: 'object',
  properties: {
    meta: IMetaJSONSchema,
    coop: CooperativeSchema,
    vars: VarsSchema,
    decision: decisionSchema,
    proposal_hash: { type: 'string' },
    cycle_started_at: { type: 'string' },
    total_amount: { type: 'string' },
    items_count: { type: 'number' },
  },
  required: ['meta', 'coop', 'vars', 'decision', 'proposal_hash', 'cycle_started_at', 'total_amount', 'items_count'],
  additionalProperties: true,
}

export const Template: ITemplate<Model> = {
  title: Cooperative.Registry.MarketplaceWriteoffProtocol.title,
  description: Cooperative.Registry.MarketplaceWriteoffProtocol.description,
  model: Schema,
  context: Cooperative.Registry.MarketplaceWriteoffProtocol.context,
  translations: Cooperative.Registry.MarketplaceWriteoffProtocol.translations,
}
