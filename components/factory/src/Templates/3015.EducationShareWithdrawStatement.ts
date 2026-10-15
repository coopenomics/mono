import type { JSONSchemaType } from 'ajv'
import { Cooperative } from 'cooptypes'
import type { ITemplate } from '../Interfaces'
import { IMetaJSONSchema } from '../Schema/MetaSchema'
import { CooperativeSchema } from '../Schema'
import { VarsSchema } from '../Schema/VarsSchema'
import { CommonUserSchema } from '../Schema/CommonUserSchema'

export const registry_id = Cooperative.Registry.EducationShareWithdrawStatement.registry_id

export type Action = Cooperative.Registry.EducationShareWithdrawStatement.Action

export type Model = Cooperative.Registry.EducationShareWithdrawStatement.Model

export const Schema: JSONSchemaType<Model> = {
  type: 'object',
  properties: {
    meta: IMetaJSONSchema,
    coop: CooperativeSchema,
    vars: VarsSchema,
    user: CommonUserSchema,
    amount: { type: 'string' },
  },
  required: ['meta', 'coop', 'vars', 'user', 'amount'],
  additionalProperties: true,
}

export const Template: ITemplate<Model> = {
  title: Cooperative.Registry.EducationShareWithdrawStatement.title,
  description: Cooperative.Registry.EducationShareWithdrawStatement.description,
  model: Schema,
  context: Cooperative.Registry.EducationShareWithdrawStatement.context,
  translations: Cooperative.Registry.EducationShareWithdrawStatement.translations,
}
