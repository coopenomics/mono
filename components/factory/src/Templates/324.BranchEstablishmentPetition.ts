import type { JSONSchemaType } from 'ajv'
import { Cooperative } from 'cooptypes'
import type { ITemplate } from '../Interfaces'
import { IMetaJSONSchema } from '../Schema/MetaSchema'
import { CommonUserSchema, CooperativeSchema, VarsSchema } from '../Schema'

export const registry_id = Cooperative.Registry.BranchEstablishmentPetition.registry_id

// Модель действия для генерации
export type Action = Cooperative.Registry.BranchEstablishmentPetition.Action

// Модель данных
export type Model = Cooperative.Registry.BranchEstablishmentPetition.Model

// Схема для сверки
export const Schema: JSONSchemaType<Model> = {
  type: 'object',
  properties: {
    meta: IMetaJSONSchema,
    coop: CooperativeSchema,
    user: CommonUserSchema,
    branch_name: { type: 'string' },
    address: { type: 'string' },
    chairman_full_name: { type: 'string' },
    vars: VarsSchema,
  },
  required: ['meta', 'coop', 'user', 'branch_name', 'address', 'chairman_full_name', 'vars'],
  additionalProperties: true,
}

export const Template: ITemplate<Model> = {
  title: Cooperative.Registry.BranchEstablishmentPetition.title,
  description: Cooperative.Registry.BranchEstablishmentPetition.description,
  model: Schema,
  context: Cooperative.Registry.BranchEstablishmentPetition.context,
  translations: Cooperative.Registry.BranchEstablishmentPetition.translations,
}
