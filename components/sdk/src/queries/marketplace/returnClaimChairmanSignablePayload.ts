import { documentSelector } from '../../selectors/common/documentSelector'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'marketplaceReturnClaimChairmanSignablePayload'

/**
 * Заявление оператора участка в совет об отмене сделки по гарантийному
 * возврату (1116) — генерируется по рекламации, заказу и результату осмотра;
 * оператор подписывает одной подписью и отправляет в acceptReturnAtVisit.
 */
export const query = Selector('Query')({
  [name]: [
    { claim_id: $('claim_id', 'String!'), inspection_result: $('inspection_result', 'String!') },
    documentSelector,
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
