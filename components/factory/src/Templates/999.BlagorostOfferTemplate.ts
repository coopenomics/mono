import type { JSONSchemaType } from 'ajv'
import { Cooperative } from 'cooptypes'
import type { ITemplate } from '../Interfaces'
import { IMetaJSONSchema } from '../Schema/MetaSchema'
import { CapitalProgramPrivateDataSchema } from '../Schema/CapitalProgramPrivateDataSchema'
import { CooperativeSchema, VarsSchema } from '../Schema'

export const registry_id = Cooperative.Registry.BlagorostOfferTemplate.registry_id

export type Action = Cooperative.Registry.BlagorostOfferTemplate.Action

export type Model = Cooperative.Registry.BlagorostOfferTemplate.Model

export const Schema: JSONSchemaType<Model> = {
  type: 'object',
  properties: {
    meta: IMetaJSONSchema,
    coop: CooperativeSchema,
    vars: VarsSchema,
    doc_data: CapitalProgramPrivateDataSchema,
  },
  required: ['meta', 'coop', 'vars', 'doc_data'],
  additionalProperties: true,
}

export const Template: ITemplate<Model> = {
  title: Cooperative.Registry.BlagorostOfferTemplate.title,
  description: Cooperative.Registry.BlagorostOfferTemplate.description,
  model: Schema,
  context: Cooperative.Registry.BlagorostOfferTemplate.context,
  translations: Cooperative.Registry.BlagorostOfferTemplate.translations,
}
