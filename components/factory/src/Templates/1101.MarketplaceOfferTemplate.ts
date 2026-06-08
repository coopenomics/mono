import type { JSONSchemaType } from 'ajv'
import { Cooperative } from 'cooptypes'
import type { ITemplate } from '../Interfaces'
import { CooperativeSchema } from '../Schema'
import { IMetaJSONSchema } from '../Schema/MetaSchema'
import { VarsSchema } from '../Schema/VarsSchema'

export const registry_id = Cooperative.Registry.MarketplaceOfferTemplate.registry_id

// Шаблон публичной оферты ЦПП «Стол заказов».
// Эпик 1 / Story 1.7 / 1.9 — утверждается Советом, после accept'a
// регистрируется в core AgreementRegistry под id `marketplace_offer`.
export type Action = Cooperative.Registry.MarketplaceOfferTemplate.Action

export type Model = Cooperative.Registry.MarketplaceOfferTemplate.Model

export const Schema: JSONSchemaType<Model> = {
  type: 'object',
  properties: {
    meta: IMetaJSONSchema,
    coop: CooperativeSchema,
    vars: VarsSchema,
  },
  required: ['meta', 'coop', 'vars'],
  additionalProperties: true,
}

export const Template: ITemplate<Model> = {
  title: Cooperative.Registry.MarketplaceOfferTemplate.title,
  description: Cooperative.Registry.MarketplaceOfferTemplate.description,
  model: Schema,
  context: Cooperative.Registry.MarketplaceOfferTemplate.context,
  translations: Cooperative.Registry.MarketplaceOfferTemplate.translations,
}
