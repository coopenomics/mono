import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'marketplaceGetAvailabilityStats'

export const query = Selector('Query')({
  [name]: {
    totalAvailable: true,
    categoriesCount: true,
    typesCount: true,
    hasRestrictions: true,
  },
})

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
