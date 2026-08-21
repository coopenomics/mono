import type { JSONSchemaType } from 'ajv'
import { Cooperative } from 'cooptypes'
import type { ITemplate } from '../Interfaces'
import { IMetaJSONSchema } from '../Schema/MetaSchema'
import { CooperativeSchema } from '../Schema'
import { VarsSchema } from '../Schema/VarsSchema'

export const registry_id = Cooperative.Registry.EducationTeacherOfferTemplate.registry_id

export type Action = Cooperative.Registry.EducationTeacherOfferTemplate.Action

export type Model = Cooperative.Registry.EducationTeacherOfferTemplate.Model

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
  title: Cooperative.Registry.EducationTeacherOfferTemplate.title,
  description: Cooperative.Registry.EducationTeacherOfferTemplate.description,
  model: Schema,
  context: Cooperative.Registry.EducationTeacherOfferTemplate.context,
  translations: Cooperative.Registry.EducationTeacherOfferTemplate.translations,
}
