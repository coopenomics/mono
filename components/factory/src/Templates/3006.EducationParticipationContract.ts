import type { JSONSchemaType } from 'ajv'
import { Cooperative } from 'cooptypes'
import type { ITemplate } from '../Interfaces'
import { IMetaJSONSchema } from '../Schema/MetaSchema'
import { CooperativeSchema } from '../Schema'
import { VarsSchema } from '../Schema/VarsSchema'
import { CommonUserSchema } from '../Schema/CommonUserSchema'

export const registry_id = Cooperative.Registry.EducationParticipationContract.registry_id

export type Action = Cooperative.Registry.EducationParticipationContract.Action

export type Model = Cooperative.Registry.EducationParticipationContract.Model

export const Schema: JSONSchemaType<Model> = {
  type: 'object',
  properties: {
    meta: IMetaJSONSchema,
    coop: CooperativeSchema,
    vars: VarsSchema,
    common_user: CommonUserSchema,
    contract_number: { type: 'string' },
    contract_created_at: { type: 'string' },
  },
  required: ['meta', 'coop', 'vars', 'common_user', 'contract_number', 'contract_created_at'],
  additionalProperties: true,
}

export const Template: ITemplate<Model> = {
  title: Cooperative.Registry.EducationParticipationContract.title,
  description: Cooperative.Registry.EducationParticipationContract.description,
  model: Schema,
  context: Cooperative.Registry.EducationParticipationContract.context,
  translations: Cooperative.Registry.EducationParticipationContract.translations,
}
