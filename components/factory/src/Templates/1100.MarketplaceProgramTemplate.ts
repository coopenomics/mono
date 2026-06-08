import type { JSONSchemaType } from 'ajv'
import { Cooperative } from 'cooptypes'
import type { ITemplate } from '../Interfaces'
import { CooperativeSchema } from '../Schema'
import { IMetaJSONSchema } from '../Schema/MetaSchema'
import { VarsSchema } from '../Schema/VarsSchema'

export const registry_id = Cooperative.Registry.MarketplaceProgramTemplate.registry_id

// Положение о ЦПП «Стол заказов».
// Эпик 1 — первый документ онбординга, утверждается Советом до шаблона оферты
// (1101.MarketplaceOfferTemplate). Аналог 998.BlagorostProgramTemplate в Капитале.
export type Action = Cooperative.Registry.MarketplaceProgramTemplate.Action

export type Model = Cooperative.Registry.MarketplaceProgramTemplate.Model

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
  title: Cooperative.Registry.MarketplaceProgramTemplate.title,
  description: Cooperative.Registry.MarketplaceProgramTemplate.description,
  model: Schema,
  context: Cooperative.Registry.MarketplaceProgramTemplate.context,
  translations: Cooperative.Registry.MarketplaceProgramTemplate.translations,
}
