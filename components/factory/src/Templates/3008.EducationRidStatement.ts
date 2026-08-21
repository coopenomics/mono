import type { JSONSchemaType } from 'ajv'
import { Cooperative } from 'cooptypes'
import type { ITemplate } from '../Interfaces'
import { IMetaJSONSchema } from '../Schema/MetaSchema'
import { CooperativeSchema } from '../Schema'
import { VarsSchema } from '../Schema/VarsSchema'
import { CommonUserSchema } from '../Schema/CommonUserSchema'
import { CommonProgramSchema } from '../Schema/CommonProgramSchema'

export const registry_id = Cooperative.Registry.EducationRidStatement.registry_id

export type Action = Cooperative.Registry.EducationRidStatement.Action

export type Model = Cooperative.Registry.EducationRidStatement.Model

export const Schema: JSONSchemaType<Model> = {
  type: 'object',
  properties: {
    meta: IMetaJSONSchema,
    coop: CooperativeSchema,
    vars: VarsSchema,
    user: CommonUserSchema,
    program: CommonProgramSchema,
    rid_hash: { type: 'string' },
    assignment_id: { type: 'number' },
    amount: { type: 'string' },
    rid_type: { type: 'string' },
    links: { type: 'array', items: { type: 'string' } },
  },
  required: ['meta', 'coop', 'vars', 'user', 'program', 'rid_hash', 'assignment_id', 'amount', 'rid_type', 'links'],
  additionalProperties: true,
}

export const Template: ITemplate<Model> = {
  title: Cooperative.Registry.EducationRidStatement.title,
  description: Cooperative.Registry.EducationRidStatement.description,
  model: Schema,
  context: Cooperative.Registry.EducationRidStatement.context,
  translations: Cooperative.Registry.EducationRidStatement.translations,
}
