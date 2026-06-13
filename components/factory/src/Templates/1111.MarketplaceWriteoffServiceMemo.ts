import type { JSONSchemaType } from 'ajv'
import { Cooperative } from 'cooptypes'
import type { ITemplate } from '../Interfaces'
import { IMetaJSONSchema } from '../Schema/MetaSchema'
import { CooperativeSchema } from '../Schema'
import { VarsSchema } from '../Schema/VarsSchema'
import { CommonUserSchema } from '../Schema/CommonUserSchema'
import { CommonProgramSchema } from '../Schema/CommonProgramSchema'

export const registry_id = Cooperative.Registry.MarketplaceWriteoffServiceMemo.registry_id

export type Action = Cooperative.Registry.MarketplaceWriteoffServiceMemo.Action

export type Model = Cooperative.Registry.MarketplaceWriteoffServiceMemo.Model

const WriteoffMemoItemSchema: JSONSchemaType<Cooperative.Registry.MarketplaceWriteoffServiceMemo.WriteoffMemoItem> = {
  type: 'object',
  properties: {
    asset_title: { type: 'string' },
    quantity: { type: 'string' },
    amount: { type: 'string' },
    reason: { type: 'string' },
  },
  required: ['asset_title', 'quantity', 'amount', 'reason'],
  additionalProperties: true,
}

export const Schema: JSONSchemaType<Model> = {
  type: 'object',
  properties: {
    meta: IMetaJSONSchema,
    coop: CooperativeSchema,
    vars: VarsSchema,
    chairman: CommonUserSchema,
    program: CommonProgramSchema,
    proposal_hash: { type: 'string' },
    branch_name: { type: 'string' },
    cycle_started_at: { type: 'string' },
    items: { type: 'array', items: WriteoffMemoItemSchema, minItems: 1 },
    total_amount: { type: 'string' },
  },
  required: ['meta', 'coop', 'vars', 'chairman', 'program', 'proposal_hash', 'branch_name', 'cycle_started_at', 'items', 'total_amount'],
  additionalProperties: true,
}

export const Template: ITemplate<Model> = {
  title: Cooperative.Registry.MarketplaceWriteoffServiceMemo.title,
  description: Cooperative.Registry.MarketplaceWriteoffServiceMemo.description,
  model: Schema,
  context: Cooperative.Registry.MarketplaceWriteoffServiceMemo.context,
  translations: Cooperative.Registry.MarketplaceWriteoffServiceMemo.translations,
}
