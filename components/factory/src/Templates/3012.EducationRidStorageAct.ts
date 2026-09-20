import type { JSONSchemaType } from 'ajv'
import { Cooperative } from 'cooptypes'
import type { ITemplate } from '../Interfaces'
import { IMetaJSONSchema } from '../Schema/MetaSchema'
import { CooperativeSchema } from '../Schema'
import { VarsSchema } from '../Schema/VarsSchema'
import { CommonUserSchema } from '../Schema/CommonUserSchema'
import { CommonProgramSchema } from '../Schema/CommonProgramSchema'

export const registry_id = Cooperative.Registry.EducationRidStorageAct.registry_id

export type Action = Cooperative.Registry.EducationRidStorageAct.Action

export type Model = Cooperative.Registry.EducationRidStorageAct.Model

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
    course_title: { type: 'string' },
    lesson_number: { type: 'number' },
    lesson_topic: { type: 'string' },
    held_at: { type: 'string' },
    duration_minutes: { type: 'number' },
    materials: { type: 'array', items: { type: 'string' } },
    hold_until: { type: 'string' },
  },
  required: [
    'meta', 'coop', 'vars', 'user', 'program',
    'rid_hash', 'rid_short_hash', 'amount', 'rid_type',
    'course_title', 'lesson_number', 'lesson_topic', 'held_at',
    'duration_minutes', 'materials', 'hold_until',
  ],
  additionalProperties: true,
}

export const Template: ITemplate<Model> = {
  title: Cooperative.Registry.EducationRidStorageAct.title,
  description: Cooperative.Registry.EducationRidStorageAct.description,
  model: Schema,
  context: Cooperative.Registry.EducationRidStorageAct.context,
  translations: Cooperative.Registry.EducationRidStorageAct.translations,
}
