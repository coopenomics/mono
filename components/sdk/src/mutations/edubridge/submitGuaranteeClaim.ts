import { eduGuaranteeClaimSelector } from '../../selectors/edubridge/guaranteeSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'edubridgeSubmitGuaranteeClaim'

/** Подать подписанное заявление об аннулировании подписки по гарантийным условиям */
export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'EduSubmitGuaranteeClaimInput!') }, eduGuaranteeClaimSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['EduSubmitGuaranteeClaimInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
