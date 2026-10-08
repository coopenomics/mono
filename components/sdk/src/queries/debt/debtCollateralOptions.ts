import { collateralOptionSelector } from '../../selectors/debt'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'debtCollateralOptions'

export const query = Selector('Query')({
  [name]: [{ coopname: $('coopname', 'String!') }, collateralOptionSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  coopname: string
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
