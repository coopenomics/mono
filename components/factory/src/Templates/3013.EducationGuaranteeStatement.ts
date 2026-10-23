import type { JSONSchemaType } from 'ajv'
import { Cooperative } from 'cooptypes'
import type { ITemplate } from '../Interfaces'
import { IMetaJSONSchema } from '../Schema/MetaSchema'
import { CooperativeSchema } from '../Schema'
import { VarsSchema } from '../Schema/VarsSchema'
import { CommonUserSchema } from '../Schema/CommonUserSchema'

export const registry_id = Cooperative.Registry.EducationGuaranteeStatement.registry_id

export type Action = Cooperative.Registry.EducationGuaranteeStatement.Action

export type Model = Cooperative.Registry.EducationGuaranteeStatement.Model

export const Schema: JSONSchemaType<Model> = {
  type: 'object',
  properties: {
    meta: IMetaJSONSchema,
    coop: CooperativeSchema,
    vars: VarsSchema,
    user: CommonUserSchema,
    claim_hash: { type: 'string' },
    claim_short_hash: { type: 'string' },
    course_title: { type: 'string' },
    subscribed_at: { type: 'string' },
    amount: { type: 'string' },
    guarantee_until: { type: 'string' },
    reason: { type: 'string' },
    links: { type: 'array', items: { type: 'string' } },
  },
  required: ['meta', 'coop', 'vars', 'user', 'claim_hash', 'claim_short_hash', 'course_title', 'subscribed_at', 'amount', 'guarantee_until', 'reason', 'links'],
  additionalProperties: true,
}

export const Template: ITemplate<Model> = {
  title: Cooperative.Registry.EducationGuaranteeStatement.title,
  description: Cooperative.Registry.EducationGuaranteeStatement.description,
  model: Schema,
  context: Cooperative.Registry.EducationGuaranteeStatement.context,
  translations: Cooperative.Registry.EducationGuaranteeStatement.translations,
}
