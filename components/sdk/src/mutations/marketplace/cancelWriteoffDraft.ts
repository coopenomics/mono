import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'marketplaceCancelWriteoffDraft'

export const mutation = Selector('Mutation')({
  [name]: [{ id: $('id', 'String!') }, true],
})

export interface IInput {
  /** @private */
  [key: string]: unknown
  id: string
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
