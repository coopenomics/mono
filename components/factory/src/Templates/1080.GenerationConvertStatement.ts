import type { JSONSchemaType } from 'ajv'
import { Cooperative } from 'cooptypes'
import type { ITemplate } from '../Interfaces'
import { CooperativeSchema } from '../Schema'
import { IMetaJSONSchema } from '../Schema/MetaSchema'
import { VarsSchema } from '../Schema/VarsSchema'
import { CommonUserSchema } from '../Schema/CommonUserSchema'

export const registry_id = Cooperative.Registry.GenerationConvertStatement.registry_id

// Модель действия для генерации
export type Action = Cooperative.Registry.GenerationConvertStatement.Action

// Модель данных
export type Model = Cooperative.Registry.GenerationConvertStatement.Model

// Схема для сверки
export const Schema: JSONSchemaType<Model> = {
  type: 'object',
  properties: {
    meta: IMetaJSONSchema,
    coop: CooperativeSchema,
    vars: VarsSchema,
    common_user: CommonUserSchema,
    contributor_contract_number: { type: 'string' },
    contributor_contract_created_at: { type: 'string' },
    appendix_hash: { type: 'string' },
    appendix_short_hash: { type: 'string' },
    project_hash: { type: 'string' },
    project_short_hash: { type: 'string' },
    main_wallet_amount: { type: 'string' },
    blagorost_wallet_amount: { type: 'string' },
    to_wallet: { type: 'boolean' },
    to_blagorost: { type: 'boolean' },
  },
  required: ['meta', 'coop', 'vars', 'common_user', 'contributor_contract_number', 'contributor_contract_created_at', 'appendix_hash', 'appendix_short_hash', 'project_hash', 'project_short_hash', 'main_wallet_amount', 'blagorost_wallet_amount', 'to_wallet', 'to_blagorost'],
  additionalProperties: true,
}

export const Template: ITemplate<Model> = {
  title: Cooperative.Registry.GenerationConvertStatement.title,
  description: Cooperative.Registry.GenerationConvertStatement.description,
  model: Schema,
  context: Cooperative.Registry.GenerationConvertStatement.context,
  translations: Cooperative.Registry.GenerationConvertStatement.translations,
}
