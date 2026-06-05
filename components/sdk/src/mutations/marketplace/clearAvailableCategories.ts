import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'marketplaceClearAvailableCategories'

export const mutation = Selector('Mutation')({
  [name]: true,
})

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
