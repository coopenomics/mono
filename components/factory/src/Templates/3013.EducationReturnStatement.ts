import type { JSONSchemaType } from 'ajv'
import { Cooperative } from 'cooptypes'
import type { ITemplate } from '../Interfaces'
import { IMetaJSONSchema } from '../Schema/MetaSchema'
import { CooperativeSchema } from '../Schema'
import { VarsSchema } from '../Schema/VarsSchema'
import { CommonUserSchema } from '../Schema/CommonUserSchema'
import { CommonProgramSchema } from '../Schema/CommonProgramSchema'

export const registry_id = Cooperative.Registry.EducationReturnStatement.registry_id

export type Action = Cooperative.Registry.EducationReturnStatement.Action

export type Model = Cooperative.Registry.EducationReturnStatement.Model

export const Schema: JSONSchemaType<Model> = {
  type: 'object',
  properties: {
    meta: IMetaJSONSchema,
    coop: CooperativeSchema,
    vars: VarsSchema,
    user: CommonUserSchema,
    program: CommonProgramSchema,
    amount: { type: 'string' },
  },
  required: ['meta', 'coop', 'vars', 'user', 'program', 'amount'],
  additionalProperties: true,
}

export const Template: ITemplate<Model> = {
  title: Cooperative.Registry.EducationReturnStatement.title,
  description: Cooperative.Registry.EducationReturnStatement.description,
  model: Schema,
  context: Cooperative.Registry.EducationReturnStatement.context,
  translations: Cooperative.Registry.EducationReturnStatement.translations,
}
