import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'marketplaceWhoAmI'

export const query = Selector('Query')({
  [name]: {
    username: true,
    core_roles: true,
    marketplace_roles: true,
    branches: true,
  },
})

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
