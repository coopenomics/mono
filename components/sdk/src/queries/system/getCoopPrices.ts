import { coopPriceSelector } from '../../selectors/system/coopPriceSelector'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'getCoopPrices'

/** Индивидуальные цены услуг кооператива у оператора. */
export const query = Selector('Query')({
  [name]: [{ coopname: $('coopname', 'String!') }, coopPriceSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  coopname: string
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
