import type { JSONSchemaType } from 'ajv'
import { Cooperative } from 'cooptypes'
import type { ITemplate } from '../Interfaces'
import { IMetaJSONSchema } from '../Schema/MetaSchema'
import { CommonUserSchema, CooperativeSchema, VarsSchema } from '../Schema'

export const registry_id = Cooperative.Registry.ProgramAgreementsAnnulmentStatement.registry_id

export type Action = Cooperative.Registry.ProgramAgreementsAnnulmentStatement.Action
export type Model = Cooperative.Registry.ProgramAgreementsAnnulmentStatement.Model

export const Schema: JSONSchemaType<Model> = {
  type: 'object',
  properties: {
    meta: IMetaJSONSchema,
    coop: CooperativeSchema,
    user: CommonUserSchema,
    vars: VarsSchema,
    exit_hash: { type: 'string' },
    programs: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          program_id: { type: 'number' },
          title: { type: 'string' },
          agreement_signed_at: { type: 'string' },
          agreement_hash: { type: 'string' },
          refund: { type: 'string' },
          wallets: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                wallet_name: { type: 'string' },
                human_name: { type: 'string' },
                balance: { type: 'string' },
                returns: { type: 'boolean' },
              },
              required: ['wallet_name', 'human_name', 'balance', 'returns'],
              additionalProperties: true,
            },
          },
        },
        required: ['program_id', 'title', 'agreement_signed_at', 'agreement_hash', 'refund', 'wallets'],
        additionalProperties: true,
      },
    },
    total_refund: { type: 'string' },
  },
  required: ['meta', 'coop', 'user', 'vars', 'exit_hash', 'programs', 'total_refund'],
  additionalProperties: true,
}

export const Template: ITemplate<Model> = {
  title: Cooperative.Registry.ProgramAgreementsAnnulmentStatement.title,
  description: Cooperative.Registry.ProgramAgreementsAnnulmentStatement.description,
  model: Schema,
  context: Cooperative.Registry.ProgramAgreementsAnnulmentStatement.context,
  translations: Cooperative.Registry.ProgramAgreementsAnnulmentStatement.translations,
}
