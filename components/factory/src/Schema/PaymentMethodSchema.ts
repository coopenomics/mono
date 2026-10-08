import type { JSONSchemaType } from 'ajv'
import type { IPaymentData } from '../Interfaces'
import { BankAccountSchema } from './BankAccountSchema'

export const paymentMethodSchema: JSONSchemaType<IPaymentData> = {
  type: 'object',
  properties: {
    username: { type: 'string' },
    method_id: { type: 'string' },
    method_type: { type: 'string', enum: ['sbp', 'bank_transfer'] },
    is_default: { type: 'boolean' },
    data: {
      type: 'object',
      oneOf: [
        {
          type: 'object',
          properties: {
            phone: { type: 'string' },
            bank_name: { type: 'string', nullable: true },
          },
          required: ['phone'],
        },
        {
          type: 'object',
          properties: BankAccountSchema.properties,
          required: BankAccountSchema.required,
          additionalProperties: false,
        },
      ],
    },
    deleted: { type: 'boolean', nullable: true },
    block_num: { type: 'number', nullable: true },
  },
  required: ['username', 'method_id', 'method_type', 'is_default', 'data'],
  additionalProperties: true,
}
