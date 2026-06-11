import type { JSONSchemaType } from 'ajv'
import { Cooperative } from 'cooptypes'
import type { ITemplate } from '../Interfaces'
import { IMetaJSONSchema } from '../Schema/MetaSchema'
import { CommonUserSchema, CooperativeSchema, VarsSchema } from '../Schema'

export const registry_id = Cooperative.Registry.BranchMeetingJoinStatement.registry_id

// Модель действия для генерации
export type Action = Cooperative.Registry.BranchMeetingJoinStatement.Action

// Модель данных
export type Model = Cooperative.Registry.BranchMeetingJoinStatement.Model

// Схема для сверки
export const Schema: JSONSchemaType<Model> = {
  type: 'object',
  properties: {
    meta: IMetaJSONSchema,
    coop: CooperativeSchema,
    user: CommonUserSchema,
    vars: VarsSchema,
  },
  required: ['meta', 'coop', 'user', 'vars'],
  additionalProperties: true,
}

export const Template: ITemplate<Model> = {
  title: Cooperative.Registry.BranchMeetingJoinStatement.title,
  description: Cooperative.Registry.BranchMeetingJoinStatement.description,
  model: Schema,
  context: Cooperative.Registry.BranchMeetingJoinStatement.context,
  translations: Cooperative.Registry.BranchMeetingJoinStatement.translations,
}
