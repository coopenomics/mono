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
    braname: { type: 'string' },
    address: { type: 'string' },
    vars: VarsSchema,
  },
  required: ['meta', 'coop', 'user', 'braname', 'address', 'vars'],
  additionalProperties: true,
}

export const Template: ITemplate<Model> = {
  title: Cooperative.Registry.BranchEstablishmentPetition.title,
  description: Cooperative.Registry.BranchEstablishmentPetition.description,
  model: Schema,
  context: Cooperative.Registry.BranchEstablishmentPetition.context,
  translations: Cooperative.Registry.BranchEstablishmentPetition.translations,
}
