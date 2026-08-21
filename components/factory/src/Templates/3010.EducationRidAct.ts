import type { JSONSchemaType } from 'ajv'
import { Cooperative } from 'cooptypes'
import type { ITemplate } from '../Interfaces'
import { IMetaJSONSchema } from '../Schema/MetaSchema'
import { CooperativeSchema } from '../Schema'
import { VarsSchema } from '../Schema/VarsSchema'
import { CommonUserSchema } from '../Schema/CommonUserSchema'
import { CommonProgramSchema } from '../Schema/CommonProgramSchema'

export const registry_id = Cooperative.Registry.EducationRidAct.registry_id

export type Action = Cooperative.Registry.EducationRidAct.Action

export type Model = Cooperative.Registry.EducationRidAct.Model

export const Schema: JSONSchemaType<Model> = {
  type: 'object',
  properties: {
    meta: IMetaJSONSchema,
    coop: CooperativeSchema,
    vars: VarsSchema,
    user: CommonUserSchema,
    program: CommonProgramSchema,
    rid_hash: { type: 'string' },
    rid_short_hash: { type: 'string' },
    amount: { type: 'string' },
    rid_type: { type: 'string' },
  },
  required: ['meta', 'coop', 'vars', 'user', 'program', 'rid_hash', 'rid_short_hash', 'amount', 'rid_type'],
  additionalProperties: true,
}

export const Template: ITemplate<Model> = {
  title: Cooperative.Registry.EducationRidAct.title,
  description: Cooperative.Registry.EducationRidAct.description,
  model: Schema,
  context: Cooperative.Registry.EducationRidAct.context,
  translations: Cooperative.Registry.EducationRidAct.translations,
}
