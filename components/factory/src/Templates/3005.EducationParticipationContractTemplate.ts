import type { JSONSchemaType } from 'ajv'
import { Cooperative } from 'cooptypes'
import type { ITemplate } from '../Interfaces'
import { IMetaJSONSchema } from '../Schema/MetaSchema'
import { CooperativeSchema } from '../Schema'
import { VarsSchema } from '../Schema/VarsSchema'

export const registry_id = Cooperative.Registry.EducationParticipationContractTemplate.registry_id

export type Action = Cooperative.Registry.EducationParticipationContractTemplate.Action

export type Model = Cooperative.Registry.EducationParticipationContractTemplate.Model

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
  title: Cooperative.Registry.EducationParticipationContractTemplate.title,
  description: Cooperative.Registry.EducationParticipationContractTemplate.description,
  model: Schema,
  context: Cooperative.Registry.EducationParticipationContractTemplate.context,
  translations: Cooperative.Registry.EducationParticipationContractTemplate.translations,
}
