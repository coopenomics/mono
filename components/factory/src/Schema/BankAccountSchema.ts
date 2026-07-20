import type { JSONSchemaType } from 'ajv'
import type { IBankAccount } from '../Interfaces/BankAccounts'

export const BankAccountSchema: JSONSchemaType<IBankAccount> = {
  type: 'object',
  properties: {
    currency: { type: 'string' },
    card_number: { type: 'string', nullable: true },
    bank_name: { type: 'string' },
    account_number: { type: 'string' },
    details: {
      type: 'object',
      properties: {
        bik: { type: 'string' },
        corr: { type: 'string' },
      },
      required: ['bik', 'corr'],
      additionalProperties: true,
    },
  },
  required: [],
  additionalProperties: false,
}
