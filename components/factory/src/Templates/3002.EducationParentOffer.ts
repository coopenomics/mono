import type { JSONSchemaType } from 'ajv'
import { Cooperative } from 'cooptypes'
import type { ITemplate } from '../Interfaces'
import { IMetaJSONSchema } from '../Schema/MetaSchema'
import { CooperativeSchema } from '../Schema'
import { VarsSchema } from '../Schema/VarsSchema'
import { CommonUserSchema } from '../Schema/CommonUserSchema'

export const registry_id = Cooperative.Registry.EducationParentOffer.registry_id

export type Action = Cooperative.Registry.EducationParentOffer.Action

export type Model = Cooperative.Registry.EducationParentOffer.Model

export const Schema: JSONSchemaType<Model> = {
  type: 'object',
  properties: {
    meta: IMetaJSONSchema,
    coop: CooperativeSchema,
    vars: VarsSchema,
    common_user: CommonUserSchema,
    agreement_number: { type: 'string' },
    agreement_created_at: { type: 'string' },
  },
  required: ['meta', 'coop', 'vars', 'common_user', 'agreement_number', 'agreement_created_at'],
  additionalProperties: true,
}

export const Template: ITemplate<Model> = {
  title: Cooperative.Registry.EducationParentOffer.title,
  description: Cooperative.Registry.EducationParentOffer.description,
  model: Schema,
  context: Cooperative.Registry.EducationParentOffer.context,
  translations: Cooperative.Registry.EducationParentOffer.translations,
}
