import type { JSONSchemaType } from 'ajv'
import { Cooperative } from 'cooptypes'
import type { ITemplate } from '../Interfaces'
import { IMetaJSONSchema } from '../Schema/MetaSchema'
import { CapitalProgramPrivateDataSchema } from '../Schema/CapitalProgramPrivateDataSchema'
import { CooperativeSchema, VarsSchema } from '../Schema'

export const registry_id = Cooperative.Registry.BlagorostProgramTemplate.registry_id

export type Action = Cooperative.Registry.BlagorostProgramTemplate.Action

export type Model = Cooperative.Registry.BlagorostProgramTemplate.Model

export const Schema: JSONSchemaType<Model> = {
  type: 'object',
  properties: {
    meta: IMetaJSONSchema,
    coop: CooperativeSchema,
    vars: VarsSchema,
    doc_data: CapitalProgramPrivateDataSchema,
  },
  required: ['meta', 'coop', 'vars', 'doc_data'],
  additionalProperties: true,
}

export const Template: ITemplate<Model> = {
  title: Cooperative.Registry.BlagorostProgramTemplate.title,
  description: Cooperative.Registry.BlagorostProgramTemplate.description,
  model: Schema,
  context: Cooperative.Registry.BlagorostProgramTemplate.context,
  translations: Cooperative.Registry.BlagorostProgramTemplate.translations,
}
