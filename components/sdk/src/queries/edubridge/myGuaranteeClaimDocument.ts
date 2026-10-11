import { documentAggregateSelector } from '../../selectors/documents'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'edubridgeMyGuaranteeClaimDocument'

/** Моё подписанное заявление об аннулировании подписки по гарантийным условиям */
export const query = Selector('Query')({
  [name]: [{ claim_id: $('claim_id', 'ID!') }, documentAggregateSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  claim_id: string
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
