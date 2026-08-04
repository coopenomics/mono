import type { JSONSchemaType } from 'ajv'
import { Cooperative } from 'cooptypes'

export const CapitalApprovalHeaderSchema: JSONSchemaType<Cooperative.Registry.CapitalApprovalHeader> = {
  type: 'object',
  properties: {
    protocol_number: { type: 'string' },
    protocol_day_month_year: { type: 'string' },
  },
  required: ['protocol_number', 'protocol_day_month_year'],
  additionalProperties: false,
}

export const CapitalProgramPrivateDataSchema: JSONSchemaType<Cooperative.Registry.CapitalProgramPrivateData> = {
  type: 'object',
  properties: {
    generator_program_purpose: { type: 'string' },
    eoap_definition: { type: 'string' },
    generator_task_goal: { type: 'string' },
    idea_unit_cost: { type: 'string' },
    idea_unit_cost_words: { type: 'string' },
    blagorost_goal_expansion: { type: 'string' },
    blagorost_goal_reason: { type: 'string' },
    blagorost_task_expansion: { type: 'string' },
    blagorost_task_development: { type: 'string' },
    return_source_description: { type: 'string' },
    return_additional_source: { type: 'string' },
  },
  required: [...Cooperative.Registry.capitalProgramPrivateDataRequiredFields],
  additionalProperties: false,
}
