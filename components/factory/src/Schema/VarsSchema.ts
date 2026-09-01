import type { JSONSchemaType } from 'ajv'
import type { IVars } from '../Models'

export const VarsSchema: JSONSchemaType<IVars> = {
  type: 'object',
  properties: {
    deleted: { type: 'boolean', nullable: true },
    block_num: { type: 'number', nullable: true },
    coopname: { type: 'string' },
    full_abbr: { type: 'string' },
    full_abbr_genitive: { type: 'string' },
    full_abbr_dative: { type: 'string' },
    short_abbr: { type: 'string' },
    website: { type: 'string' },
    name: { type: 'string' },
    confidential_link: { type: 'string' },
    confidential_email: { type: 'string' },
    contact_email: { type: 'string' },
    passport_request: { type: 'string' },
    wallet_agreement: {
      type: 'object',
      nullable: true,
      properties: {
        protocol_number: { type: 'string' },
        protocol_day_month_year: { type: 'string' },
      },
      required: ['protocol_day_month_year', 'protocol_number'],
      additionalProperties: true,
    },
    privacy_agreement: {
      type: 'object',
      nullable: true,
      properties: {
        protocol_number: { type: 'string' },
        protocol_day_month_year: { type: 'string' },
      },
      required: ['protocol_day_month_year', 'protocol_number'],
      additionalProperties: true,
    },
    signature_agreement: {
      type: 'object',
      nullable: true,
      properties: {
        protocol_number: { type: 'string' },
        protocol_day_month_year: { type: 'string' },
      },
      required: ['protocol_day_month_year', 'protocol_number'],
      additionalProperties: true,
    },
    user_agreement: {
      type: 'object',
      nullable: true,
      properties: {
        protocol_number: { type: 'string' },
        protocol_day_month_year: { type: 'string' },
      },
      required: ['protocol_day_month_year', 'protocol_number'],
      additionalProperties: true,
    },
    participant_application: {
      type: 'object',
      nullable: true,
      properties: {
        protocol_number: { type: 'string' },
        protocol_day_month_year: { type: 'string' },
      },
      required: ['protocol_day_month_year', 'protocol_number'],
      additionalProperties: true,
    },
    coopenomics_agreement: {
      type: 'object',
      properties: {
        protocol_number: { type: 'string' },
        protocol_day_month_year: { type: 'string' },
      },
      required: ['protocol_day_month_year', 'protocol_number'],
      additionalProperties: true,
      nullable: true,
    },
    generation_contract_template: {
      type: 'object',
      properties: {
        protocol_number: { type: 'string' },
        protocol_day_month_year: { type: 'string' },
      },
      required: ['protocol_day_month_year', 'protocol_number'],
      additionalProperties: true,
      nullable: true,
    },
    blagorost_program: {
      type: 'object',
      nullable: true,
      properties: {
        protocol_number: { type: 'string' },
        protocol_day_month_year: { type: 'string' },
      },
      required: ['protocol_number', 'protocol_day_month_year'],
      additionalProperties: true,
    },
    blagorost_offer_template: {
      type: 'object',
      nullable: true,
      properties: {
        protocol_number: { type: 'string' },
        protocol_day_month_year: { type: 'string' },
      },
      required: ['protocol_number', 'protocol_day_month_year'],
      additionalProperties: true,
    },
    generator_program: {
      type: 'object',
      nullable: true,
      properties: {
        protocol_number: { type: 'string' },
        protocol_day_month_year: { type: 'string' },
      },
      required: ['protocol_number', 'protocol_day_month_year'],
      additionalProperties: true,
    },
    generator_offer_template: {
      type: 'object',
      nullable: true,
      properties: {
        protocol_number: { type: 'string' },
        protocol_day_month_year: { type: 'string' },
      },
      required: ['protocol_number', 'protocol_day_month_year'],
      additionalProperties: true,
    },
    marketplace_program: {
      type: 'object',
      nullable: true,
      properties: {
        protocol_number: { type: 'string' },
        protocol_day_month_year: { type: 'string' },
      },
      required: ['protocol_number', 'protocol_day_month_year'],
      additionalProperties: true,
    },
    marketplace_offer_template: {
      type: 'object',
      nullable: true,
      properties: {
        protocol_number: { type: 'string' },
        protocol_day_month_year: { type: 'string' },
      },
      required: ['protocol_number', 'protocol_day_month_year'],
      additionalProperties: true,
    },
    education_provision: {
      type: 'object',
      nullable: true,
      properties: {
        protocol_number: { type: 'string' },
        protocol_day_month_year: { type: 'string' },
      },
      required: ['protocol_number', 'protocol_day_month_year'],
      additionalProperties: true,
    },
    education_parent_offer_template: {
      type: 'object',
      nullable: true,
      properties: {
        protocol_number: { type: 'string' },
        protocol_day_month_year: { type: 'string' },
      },
      required: ['protocol_number', 'protocol_day_month_year'],
      additionalProperties: true,
    },
    education_teacher_offer_template: {
      type: 'object',
      nullable: true,
      properties: {
        protocol_number: { type: 'string' },
        protocol_day_month_year: { type: 'string' },
      },
      required: ['protocol_number', 'protocol_day_month_year'],
      additionalProperties: true,
    },
    education_contract_template: {
      type: 'object',
      nullable: true,
      properties: {
        protocol_number: { type: 'string' },
        protocol_day_month_year: { type: 'string' },
      },
      required: ['protocol_number', 'protocol_day_month_year'],
      additionalProperties: true,
    },
  },
  required: [ // соблюдать порядок следования!
    // 'deleted', //not_required
    // 'block_num', //not_required
    'coopname',
    'full_abbr',
    'full_abbr_genitive',
    'full_abbr_dative',
    'short_abbr',
    'website',
    'name',
    'confidential_link',
    'confidential_email',
    'contact_email',
    // 'wallet_agreement', //not_required
    // 'signature_agreement', //not_required
    // 'privacy_agreement', //not_required
    // 'user_agreement', //not_required
    // 'participant_application', //not_required
    // 'coopenomics_agreement', //not_required
    // 'generation_contract_template', //not_required
    // 'blagorost_program', //not_required
    // 'blagorost_offer_template', //not_required
    // 'generator_program', //not_required
    // 'generator_offer_template', //not_required
  ],
  additionalProperties: true,
}
