import { eduRefundPreviewSelector } from '../../selectors/edubridge/memberSelector'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'edubridgeRefundPreview'

export const query = Selector('Query')({
  [name]: [{ enrollment_id: $('enrollment_id', 'ID!') }, eduRefundPreviewSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  enrollment_id: string
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
