import { documentAggregateSelector } from '../../selectors/documents'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'edubridgeMyShareReturnDocuments'

/** Заявления моего возврата паевого взноса: о трансляции в Цифровой Кошелёк и о возврате */
export const query = Selector('Query')({
  [name]: [{ return_id: $('return_id', 'ID!') }, { kind: true, document: documentAggregateSelector }],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  return_id: string
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
