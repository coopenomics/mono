import { membershipExitSelector } from '../../selectors/membershipExit/membershipExitSelector'
import { $, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'membershipExit'

/**
 * Текущий процесс выхода пайщика из кооператива (статус + сумма возврата), либо null.
 */
export const query = Selector('Query')({
  [name]: [{ coopname: $('coopname', 'String!'), username: $('username', 'String!') }, membershipExitSelector],
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
  [name]: ModelTypes['MembershipExit'] | null
}
