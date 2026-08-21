import type { JSONSchemaType } from 'ajv'
import { Cooperative } from 'cooptypes'
import type { ITemplate } from '../Interfaces'
import { IMetaJSONSchema } from '../Schema/MetaSchema'
import { CooperativeSchema } from '../Schema'
import { VarsSchema } from '../Schema/VarsSchema'
import { CommonUserSchema } from '../Schema/CommonUserSchema'
import { CommonProgramSchema } from '../Schema/CommonProgramSchema'
import { decisionSchema } from '../Schema/DecisionSchema'

export const registry_id = Cooperative.Registry.EducationRidDecision.registry_id

export type Action = Cooperative.Registry.EducationRidDecision.Action

export type Model = Cooperative.Registry.EducationRidDecision.Model

export const Schema: JSONSchemaType<Model> = {
  type: 'object',
  properties: {
    meta: IMetaJSONSchema,
    coop: CooperativeSchema,
    vars: VarsSchema,
    decision: decisionSchema,
    user: CommonUserSchema,
    program: CommonProgramSchema,
    rid_hash: { type: 'string' },
    amount: { type: 'string' },
  },
  required: ['meta', 'coop', 'vars', 'decision', 'user', 'program', 'rid_hash', 'amount'],
  additionalProperties: true,
}

export const Template: ITemplate<Model> = {
  title: Cooperative.Registry.EducationRidDecision.title,
  description: Cooperative.Registry.EducationRidDecision.description,
  model: Schema,
  context: Cooperative.Registry.EducationRidDecision.context,
  translations: Cooperative.Registry.EducationRidDecision.translations,
}
