import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceAcceptCpp'

export const mutation = Selector('Mutation')({
  [name]: [
    { input: $('input', 'MarketplaceAcceptCppInput!') },
    {
      status: true,
      document_registry_id: true,
      accepted_at: true,
      accepted_by_board_decision_id: true,
    },
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  input: ModelTypes['MarketplaceAcceptCppInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
