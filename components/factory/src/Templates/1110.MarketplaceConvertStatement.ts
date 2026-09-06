import type { JSONSchemaType } from 'ajv'
import { Cooperative } from 'cooptypes'
import type { ITemplate } from '../Interfaces'
import { IMetaJSONSchema } from '../Schema/MetaSchema'
import { CooperativeSchema } from '../Schema'
import { VarsSchema } from '../Schema/VarsSchema'
import { CommonUserSchema } from '../Schema/CommonUserSchema'
import { CommonProgramSchema } from '../Schema/CommonProgramSchema'

export const registry_id = Cooperative.Registry.MarketplaceConvertStatement.registry_id

export type Action = Cooperative.Registry.MarketplaceConvertStatement.Action

export type Model = Cooperative.Registry.MarketplaceConvertStatement.Model

export const Schema: JSONSchemaType<Model> = {
  type: 'object',
  properties: {
    meta: IMetaJSONSchema,
    coop: CooperativeSchema,
    vars: VarsSchema,
    user: CommonUserSchema,
    program: CommonProgramSchema,
    order_hash: { type: 'string' },
    amount: { type: 'string' },
    membership_fee: { type: 'string' },
    convert_amount: { type: 'string' },
    fee_percent: { type: 'number' },
    source: { type: 'string', enum: ['wallet', 'market'] },
    credited_amount: { type: 'string', nullable: true },
  },
  required: ['meta', 'coop', 'vars', 'user', 'program', 'order_hash', 'amount', 'membership_fee', 'convert_amount', 'fee_percent', 'source'],
  additionalProperties: true,
}

export const Template: ITemplate<Model> = {
  title: Cooperative.Registry.MarketplaceConvertStatement.title,
  description: Cooperative.Registry.MarketplaceConvertStatement.description,
  model: Schema,
  context: Cooperative.Registry.MarketplaceConvertStatement.context,
  translations: Cooperative.Registry.MarketplaceConvertStatement.translations,
}
