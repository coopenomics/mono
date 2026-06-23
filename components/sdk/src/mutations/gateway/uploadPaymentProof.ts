import { rawPaymentFileSelector } from '../../selectors/gateway/paymentFileSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'uploadPaymentProof'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'UploadPaymentProofInput!') }, rawPaymentFileSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['UploadPaymentProofInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
