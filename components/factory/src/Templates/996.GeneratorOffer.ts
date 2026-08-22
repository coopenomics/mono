import type { JSONSchemaType } from 'ajv'
import { Cooperative } from 'cooptypes'
import type { ITemplate } from '../Interfaces'
import { IMetaJSONSchema } from '../Schema/MetaSchema'
import { CapitalProgramPrivateDataSchema } from '../Schema/CapitalProgramPrivateDataSchema'
import { CommonUserSchema, CooperativeSchema, VarsSchema } from '../Schema'

export const registry_id = Cooperative.Registry.GeneratorOffer.registry_id

export type Action = Cooperative.Registry.GeneratorOffer.Action

export type Model = Cooperative.Registry.GeneratorOffer.Model

export const Schema: JSONSchemaType<Model> = {
  type: 'object',
  properties: {
    meta: IMetaJSONSchema,
    coop: CooperativeSchema,
    vars: VarsSchema,
    doc_data: CapitalProgramPrivateDataSchema,
    common_user: CommonUserSchema,
    generator_agreement_number: { type: 'string' },
    generator_agreement_created_at: { type: 'string' },
  },
  required: ['meta', 'coop', 'vars', 'common_user', 'generator_agreement_number', 'generator_agreement_created_at', 'doc_data'],
  additionalProperties: true,
}

export const Template: ITemplate<Model> = {
  title: Cooperative.Registry.GeneratorOffer.title,
  description: Cooperative.Registry.GeneratorOffer.description,
  model: Schema,
  context: Cooperative.Registry.GeneratorOffer.context,
  translations: Cooperative.Registry.GeneratorOffer.translations,
}
