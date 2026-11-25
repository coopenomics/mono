import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'marketplaceRemoveCooperativeLogo'

/** Администратор снимает логотип кооператива — в шапке останутся инициалы. */
export const mutation = Selector('Mutation')({
  [name]: true,
})

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
