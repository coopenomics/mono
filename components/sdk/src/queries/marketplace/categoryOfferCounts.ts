import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'marketplaceCategoryOfferCounts'

export const query = Selector('Query')({
  [name]: {
    category_id: true,
    count: true,
  },
})

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
