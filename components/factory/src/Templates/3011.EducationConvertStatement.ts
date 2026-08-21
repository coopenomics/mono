import type { JSONSchemaType } from 'ajv'
import { Cooperative } from 'cooptypes'
import type { ITemplate } from '../Interfaces'
import { IMetaJSONSchema } from '../Schema/MetaSchema'
import { CooperativeSchema } from '../Schema'
import { VarsSchema } from '../Schema/VarsSchema'
import { CommonUserSchema } from '../Schema/CommonUserSchema'
import { CommonProgramSchema } from '../Schema/CommonProgramSchema'

export const registry_id = Cooperative.Registry.EducationConvertStatement.registry_id

export type Action = Cooperative.Registry.EducationConvertStatement.Action

export type Model = Cooperative.Registry.EducationConvertStatement.Model

export const Schema: JSONSchemaType<Model> = {
  type: 'object',
  properties: {
    meta: IMetaJSONSchema,
    coop: CooperativeSchema,
    vars: VarsSchema,
    user: CommonUserSchema,
    program: CommonProgramSchema,
    sub_hash: { type: 'string' },
    amount: { type: 'string' },
    course_title: { type: 'string' },
    period: { type: 'string' },
    period_human: { type: 'string' },
  },
  required: ['meta', 'coop', 'vars', 'user', 'program', 'sub_hash', 'amount', 'course_title', 'period', 'period_human'],
  additionalProperties: true,
}

export const Template: ITemplate<Model> = {
  title: Cooperative.Registry.EducationConvertStatement.title,
  description: Cooperative.Registry.EducationConvertStatement.description,
  model: Schema,
  context: Cooperative.Registry.EducationConvertStatement.context,
  translations: Cooperative.Registry.EducationConvertStatement.translations,
}
