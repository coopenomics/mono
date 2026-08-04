import type { JSONSchemaType } from 'ajv'

/** Публичная позиция расхода — то, что едет в meta документа on-chain. */
export interface IExpenseItem {
  number: string
  description: string
  amount: string
  recipient_type: 'SELF' | 'MEMBER' | 'ORG'
  mechanics: 'ADVANCE' | 'DIRECT'
}

/** Позиция в модели рендера — публичная + приватная часть (склеена фабрикой из doc_data). */
export interface IExpenseRenderItem extends IExpenseItem {
  recipient_name?: string
  requisites?: string
  payment_purpose?: string
}

export interface IExpenseProposalHeader {
  description: string
  total_amount: string
  items_count: number
  source_wallet: string
  deadline?: string
  fund_name?: string
}

export interface IExpenseProposalDecisionBody {
  kind: 'approve' | 'decline'
  reason?: string
}

/** Схема публичной позиции (2011 «Решение совета» — без приватных полей). */
export const ExpenseItemSchema: JSONSchemaType<IExpenseItem> = {
  type: 'object',
  properties: {
    number: { type: 'string' },
    description: { type: 'string' },
    amount: { type: 'string' },
    recipient_type: { type: 'string', enum: ['SELF', 'MEMBER', 'ORG'] },
    mechanics: { type: 'string', enum: ['ADVANCE', 'DIRECT'] },
  },
  required: ['number', 'description', 'amount', 'recipient_type', 'mechanics'],
  additionalProperties: true,
}

/** Схема позиции рендера (2010 СЗ-смета — с подмешанной приватной частью). */
export const ExpenseRenderItemSchema: JSONSchemaType<IExpenseRenderItem> = {
  type: 'object',
  properties: {
    number: { type: 'string' },
    description: { type: 'string' },
    amount: { type: 'string' },
    recipient_type: { type: 'string', enum: ['SELF', 'MEMBER', 'ORG'] },
    mechanics: { type: 'string', enum: ['ADVANCE', 'DIRECT'] },
    recipient_name: { type: 'string', nullable: true },
    requisites: { type: 'string', nullable: true },
    payment_purpose: { type: 'string', nullable: true },
  },
  required: ['number', 'description', 'amount', 'recipient_type', 'mechanics'],
  additionalProperties: true,
}

export const ExpenseProposalHeaderSchema: JSONSchemaType<IExpenseProposalHeader> = {
  type: 'object',
  properties: {
    description: { type: 'string' },
    total_amount: { type: 'string' },
    items_count: { type: 'number' },
    source_wallet: { type: 'string' },
    deadline: { type: 'string', nullable: true },
    fund_name: { type: 'string', nullable: true },
  },
  required: ['description', 'total_amount', 'items_count', 'source_wallet'],
  additionalProperties: true,
}

export const ExpenseProposalDecisionBodySchema: JSONSchemaType<IExpenseProposalDecisionBody> = {
  type: 'object',
  properties: {
    kind: { type: 'string', enum: ['approve', 'decline'] },
    reason: { type: 'string', nullable: true },
  },
  required: ['kind'],
  additionalProperties: true,
}
