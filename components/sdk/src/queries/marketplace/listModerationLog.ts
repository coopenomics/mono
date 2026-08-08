import { marketplaceModerationLogEntrySelector } from '../../selectors/marketplace/moderationLogEntrySelector'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'marketplaceListModerationLog'

export const query = Selector('Query')({
  [name]: [{ offer_id: $('offer_id', 'String!') }, marketplaceModerationLogEntrySelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  offer_id: string
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
