import type { JSONSchemaType } from 'ajv'
import { Cooperative } from 'cooptypes'
import type { ITemplate } from '../Interfaces'
import { IMetaJSONSchema } from '../Schema/MetaSchema'
import { CooperativeSchema } from '../Schema'
import { VarsSchema } from '../Schema/VarsSchema'

export const registry_id = Cooperative.Registry.EducationProgramTemplate.registry_id

export type Action = Cooperative.Registry.EducationProgramTemplate.Action

export type Model = Cooperative.Registry.EducationProgramTemplate.Model

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
  title: Cooperative.Registry.EducationProgramTemplate.title,
  description: Cooperative.Registry.EducationProgramTemplate.description,
  model: Schema,
  context: Cooperative.Registry.EducationProgramTemplate.context,
  translations: Cooperative.Registry.EducationProgramTemplate.translations,
}
