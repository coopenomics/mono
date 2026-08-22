import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'marketplaceCppStatus'

export const query = Selector('Query')({
  [name]: {
    status: true,
    document_registry_id: true,
    accepted_at: true,
    accepted_by_board_decision_id: true,
  },
})

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
