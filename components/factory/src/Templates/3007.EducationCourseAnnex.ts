import type { JSONSchemaType } from 'ajv'
import { Cooperative } from 'cooptypes'
import type { ITemplate } from '../Interfaces'
import { IMetaJSONSchema } from '../Schema/MetaSchema'
import { CooperativeSchema } from '../Schema'
import { VarsSchema } from '../Schema/VarsSchema'
import { CommonUserSchema } from '../Schema/CommonUserSchema'

export const registry_id = Cooperative.Registry.EducationCourseAnnex.registry_id

export type Action = Cooperative.Registry.EducationCourseAnnex.Action

export type Model = Cooperative.Registry.EducationCourseAnnex.Model

export const Schema: JSONSchemaType<Model> = {
  type: 'object',
  properties: {
    meta: IMetaJSONSchema,
    coop: CooperativeSchema,
    vars: VarsSchema,
    common_user: CommonUserSchema,
    contract_number: { type: 'string' },
    course_title: { type: 'string' },
    schedule: { type: 'string' },
    expected_result: { type: 'string' },
    period_from: { type: 'string' },
    period_to: { type: 'string' },
  },
  required: ['meta', 'coop', 'vars', 'common_user', 'contract_number', 'course_title', 'schedule', 'expected_result', 'period_from', 'period_to'],
  additionalProperties: true,
}

export const Template: ITemplate<Model> = {
  title: Cooperative.Registry.EducationCourseAnnex.title,
  description: Cooperative.Registry.EducationCourseAnnex.description,
  model: Schema,
  context: Cooperative.Registry.EducationCourseAnnex.context,
  translations: Cooperative.Registry.EducationCourseAnnex.translations,
}
