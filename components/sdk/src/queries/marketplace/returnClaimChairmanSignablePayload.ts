import { rawDocumentAggregateSelector, rawGeneratedDocumentSelector } from '../../selectors/documents/documentAggregateSelector'
import { $, type GraphQLTypes, type InputType, Selector, type ValueTypes } from '../../zeus/index'
import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'

export const name = 'marketplaceReturnClaimChairmanSignablePayload'

const rawAcceptancePayloadSelector = {
  cancel_statement: rawGeneratedDocumentSelector,
  reclamation: rawDocumentAggregateSelector,
}

const _validate: MakeAllFieldsRequired<ValueTypes['MarketplaceReturnAcceptancePayload']> = rawAcceptancePayloadSelector

/**
 * Документы приёма имущества у стойки: заявление оператора в совет об отмене
 * сделки (1116, одна подпись оператора) и рекламация пайщика (1106) под
 * вторую подпись оператора — с ней претензия уйдёт поставщику.
 */
export const query = Selector('Query')({
  [name]: [
    { claim_id: $('claim_id', 'String!'), inspection_result: $('inspection_result', 'String!') },
    Selector('MarketplaceReturnAcceptancePayload')(rawAcceptancePayloadSelector),
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  claim_id: string
  inspection_result: string
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
