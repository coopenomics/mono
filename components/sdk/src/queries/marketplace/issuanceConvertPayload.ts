import { documentSelector } from '../../selectors/common/documentSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceIssuanceConvertPayload'

/**
 * Заявление о конвертации паевого взноса в членский (1110) на довзнос по факту —
 * к подписи заказчиком вместе с заявлением о выдаче; null, если факт не больше
 * заказа или членского кошелька «Стола заказов» хватает.
 */
export const query = Selector('Query')({
  [name]: [{ data: $('data', 'MarketplaceIssuanceOrderInput!') }, documentSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplaceIssuanceOrderInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
