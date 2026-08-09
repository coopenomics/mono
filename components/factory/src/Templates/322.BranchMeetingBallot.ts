import type { JSONSchemaType } from 'ajv'
import { Cooperative } from 'cooptypes'
import type { ITemplate } from '../Interfaces'
import { IMetaJSONSchema } from '../Schema/MetaSchema'
import { CommonUserSchema, CooperativeSchema, VarsSchema } from '../Schema'

// Схема волеизъявления по вопросу повестки
const AnswerSchema: JSONSchemaType<Cooperative.Registry.BranchMeetingBallot.IAnswer> = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    number: { type: 'string' },
    vote: { type: 'string', enum: ['for', 'against', 'abstained'] },
  },
  required: ['id', 'number', 'vote'],
  additionalProperties: true,
}

// Схема вопроса собрания участка
const QuestionSchema: JSONSchemaType<Cooperative.Registry.BranchMeetingBallot.IQuestion> = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    number: { type: 'string' },
    title: { type: 'string' },
    context: { type: 'string', nullable: true },
    decision: { type: 'string' },
  },
  required: ['id', 'number', 'title', 'decision'],
  additionalProperties: true,
}

export const registry_id = Cooperative.Registry.BranchMeetingBallot.registry_id

// Модель действия для генерации
export type Action = Cooperative.Registry.BranchMeetingBallot.Action

// Модель данных
export type Model = Cooperative.Registry.BranchMeetingBallot.Model

// Схема для сверки
export const Schema: JSONSchemaType<Model> = {
  type: 'object',
  properties: {
    meta: IMetaJSONSchema,
    coop: CooperativeSchema,
    user: CommonUserSchema,
    answers: {
      type: 'array',
      items: AnswerSchema,
      minItems: 1,
    },
    questions: {
      type: 'array',
      items: QuestionSchema,
      minItems: 1,
    },
    vars: VarsSchema,
  },
  required: ['meta', 'coop', 'user', 'answers', 'questions', 'vars'],
  additionalProperties: true,
}

export const Template: ITemplate<Model> = {
  title: Cooperative.Registry.BranchMeetingBallot.title,
  description: Cooperative.Registry.BranchMeetingBallot.description,
  model: Schema,
  context: Cooperative.Registry.BranchMeetingBallot.context,
  translations: Cooperative.Registry.BranchMeetingBallot.translations,
}
