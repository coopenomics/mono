import type { JSONSchemaType } from 'ajv'
import { Cooperative } from 'cooptypes'
import type { ITemplate } from '../Interfaces'
import { IMetaJSONSchema } from '../Schema/MetaSchema'
import { CapitalProgramPrivateDataSchema } from '../Schema/CapitalProgramPrivateDataSchema'
import { CommonUserSchema, CooperativeSchema, VarsSchema } from '../Schema'

export const registry_id = Cooperative.Registry.BlagorostOffer.registry_id

export type Action = Cooperative.Registry.BlagorostOffer.Action

export type Model = Cooperative.Registry.BlagorostOffer.Model

export const Schema: JSONSchemaType<Model> = {
  type: 'object',
  properties: {
    meta: IMetaJSONSchema,
    coop: CooperativeSchema,
    vars: VarsSchema,
    doc_data: CapitalProgramPrivateDataSchema,
    common_user: CommonUserSchema,
    blagorost_agreement_number: { type: 'string' },
    blagorost_agreement_created_at: { type: 'string' },
  },
  required: ['meta', 'coop', 'vars', 'common_user', 'blagorost_agreement_number', 'blagorost_agreement_created_at', 'doc_data'],
  additionalProperties: true,
}

export const Template: ITemplate<Model> = {
  title: Cooperative.Registry.BlagorostOffer.title,
  description: Cooperative.Registry.BlagorostOffer.description,
  model: Schema,
  context: Cooperative.Registry.BlagorostOffer.context,
  translations: Cooperative.Registry.BlagorostOffer.translations,
}
