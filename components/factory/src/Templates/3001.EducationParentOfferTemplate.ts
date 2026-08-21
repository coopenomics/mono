import type { JSONSchemaType } from 'ajv'
import { Cooperative } from 'cooptypes'
import type { ITemplate } from '../Interfaces'
import { IMetaJSONSchema } from '../Schema/MetaSchema'
import { CooperativeSchema } from '../Schema'
import { VarsSchema } from '../Schema/VarsSchema'

export const registry_id = Cooperative.Registry.EducationParentOfferTemplate.registry_id

export type Action = Cooperative.Registry.EducationParentOfferTemplate.Action

export type Model = Cooperative.Registry.EducationParentOfferTemplate.Model

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
  title: Cooperative.Registry.EducationParentOfferTemplate.title,
  description: Cooperative.Registry.EducationParentOfferTemplate.description,
  model: Schema,
  context: Cooperative.Registry.EducationParentOfferTemplate.context,
  translations: Cooperative.Registry.EducationParentOfferTemplate.translations,
}
