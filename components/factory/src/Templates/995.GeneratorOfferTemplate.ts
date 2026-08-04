import type { JSONSchemaType } from 'ajv'
import { Cooperative } from 'cooptypes'
import type { ITemplate } from '../Interfaces'
import { IMetaJSONSchema } from '../Schema/MetaSchema'
import { CapitalProgramPrivateDataSchema } from '../Schema/CapitalProgramPrivateDataSchema'
import { CommonUserSchema, CooperativeSchema, VarsSchema } from '../Schema'

export const registry_id = Cooperative.Registry.GeneratorOfferTemplate.registry_id

export type Action = Cooperative.Registry.GeneratorOfferTemplate.Action

export type Model = Cooperative.Registry.GeneratorOfferTemplate.Model

export const Schema: JSONSchemaType<Model> = {
  type: 'object',
  properties: {
    meta: IMetaJSONSchema,
    coop: CooperativeSchema,
    vars: VarsSchema,
    doc_data: CapitalProgramPrivateDataSchema,
    common_user: CommonUserSchema,
  },
  required: ['meta', 'coop', 'vars', 'common_user', 'doc_data'],
  additionalProperties: true,
}

export const Template: ITemplate<Model> = {
  title: Cooperative.Registry.GeneratorOfferTemplate.title,
  description: Cooperative.Registry.GeneratorOfferTemplate.description,
  model: Schema,
  context: Cooperative.Registry.GeneratorOfferTemplate.context,
  translations: Cooperative.Registry.GeneratorOfferTemplate.translations,
}
