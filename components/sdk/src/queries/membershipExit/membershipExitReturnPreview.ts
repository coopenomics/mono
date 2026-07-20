import { membershipExitReturnPreviewSelector } from '../../selectors/membershipExit/membershipExitReturnPreviewSelector'
import { $, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'membershipExitReturnPreview'

/**
 * Предварительный расчёт суммы возврата паевого взноса при выходе пайщика.
 */
export const query = Selector('Query')({
  [name]: [{ coopname: $('coopname', 'String!'), username: $('username', 'String!') }, membershipExitReturnPreviewSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  coopname: string
  username: string
}

export interface IOutput {
  [name]: ModelTypes['MembershipExitReturnPreview']
}
