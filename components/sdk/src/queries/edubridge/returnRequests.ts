import { eduReturnRequestSelector } from '../../selectors/edubridge/returnSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'edubridgeReturnRequests'

export const query = Selector('Query')({
  [name]: [{ status: $('status', 'EduReturnStatus') }, eduReturnRequestSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  status?: ModelTypes['EduReturnStatus'] | null
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
