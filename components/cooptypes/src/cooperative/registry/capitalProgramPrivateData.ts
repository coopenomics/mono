export interface CapitalProgramPrivateData {
  generator_program_purpose: string
  eoap_definition: string
  generator_task_goal: string
  idea_unit_cost: string
  idea_unit_cost_words: string
  blagorost_goal_expansion: string
  blagorost_goal_reason: string
  blagorost_task_expansion: string
  blagorost_task_development: string
  return_source_description: string
  return_additional_source: string
}

export interface CapitalApprovalHeader {
  protocol_number: string
  protocol_day_month_year: string
}

export const CAPITAL_APPROVAL_PLACEHOLDER: CapitalApprovalHeader = {
  protocol_number: '______',
  protocol_day_month_year: '«___» __________ 20__ г.',
}

export const capitalProgramPrivateDataRequiredFields = [
  'generator_program_purpose',
  'eoap_definition',
  'generator_task_goal',
  'idea_unit_cost',
  'idea_unit_cost_words',
  'blagorost_goal_expansion',
  'blagorost_goal_reason',
  'blagorost_task_expansion',
  'blagorost_task_development',
  'return_source_description',
  'return_additional_source',
] as const

export function resolveCapitalApprovalHeader(
  decision?: { protocol_number?: string; protocol_day_month_year?: string } | null,
): CapitalApprovalHeader {
  const protocol_number = decision?.protocol_number?.trim()
  const protocol_day_month_year = decision?.protocol_day_month_year?.trim()

  return {
    protocol_number: protocol_number || CAPITAL_APPROVAL_PLACEHOLDER.protocol_number,
    protocol_day_month_year: protocol_day_month_year || CAPITAL_APPROVAL_PLACEHOLDER.protocol_day_month_year,
  }
}

export function requireCapitalProgramPrivateData(
  payload: CapitalProgramPrivateData | null | undefined,
  registry_id: number,
): CapitalProgramPrivateData {
  if (!payload)
    throw new Error(`PrivateData для документа #${registry_id} не найдены: передайте doc_data_hash`)

  const missing = capitalProgramPrivateDataRequiredFields.filter((field) => {
    const value = payload[field]
    return typeof value !== 'string' || value.trim() === ''
  })

  if (missing.length) {
    throw new Error(`PrivateData для документа #${registry_id} заполнены не полностью: ${missing.join(', ')}`)
  }

  return payload
}
