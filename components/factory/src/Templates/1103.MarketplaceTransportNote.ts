import type { JSONSchemaType } from 'ajv'
import { Cooperative } from 'cooptypes'
import type { ITemplate } from '../Interfaces'
import { IMetaJSONSchema } from '../Schema/MetaSchema'
import { CooperativeSchema, VarsSchema, organizationSchema } from '../Schema'
import { CommonUserSchema } from '../Schema/CommonUserSchema'

export const registry_id = Cooperative.Registry.MarketplaceTransportNote.registry_id

export type Action = Cooperative.Registry.MarketplaceTransportNote.Action

export type Model = Cooperative.Registry.MarketplaceTransportNote.Model

export type PrivateData = Cooperative.Registry.MarketplaceTransportNote.PrivateData

// Схема приватного payload (off-chain). Используется только для
// контрактной проверки в тестах — продакшен валидирует на boundary
// контроллера через class-validator DTO.
const PrivateDataSchema: JSONSchemaType<PrivateData> = {
  type: 'object',
  properties: {
    expeditor_full_name: { type: 'string' },
    expeditor_phone: { type: 'string' },
    vehicle_number: { type: 'string' },
    loading_address: { type: 'string' },
    loading_datetime: { type: 'string' },
    delivery_datetime_estimate: { type: 'string' },
  },
  required: [
    'expeditor_full_name',
    'expeditor_phone',
    'vehicle_number',
    'loading_address',
    'loading_datetime',
    'delivery_datetime_estimate',
  ],
  additionalProperties: true,
}

export const Schema: JSONSchemaType<Model> = {
  type: 'object',
  properties: {
    meta: IMetaJSONSchema,
    coop: CooperativeSchema,
    vars: VarsSchema,
    ttn_number: { type: 'string' },
    cycle_id: { type: 'string' },
    shipment_id: { type: 'string' },
    accept_braname: { type: 'string' },
    total_amount: { type: 'string' },
    currency: { type: 'string' },
    supplier_account: { type: 'string' },
    supplier: CommonUserSchema,
    doc_data: PrivateDataSchema,
    branch: { ...organizationSchema, nullable: true },
  },
  required: [
    'meta',
    'coop',
    'vars',
    'ttn_number',
    'cycle_id',
    'shipment_id',
    'accept_braname',
    'total_amount',
    'currency',
    'supplier_account',
    'supplier',
    'doc_data',
  ],
  additionalProperties: true,
}

export const Template: ITemplate<Model> = {
  title: Cooperative.Registry.MarketplaceTransportNote.title,
  description: Cooperative.Registry.MarketplaceTransportNote.description,
  model: Schema,
  context: Cooperative.Registry.MarketplaceTransportNote.context,
  translations: Cooperative.Registry.MarketplaceTransportNote.translations,
}
