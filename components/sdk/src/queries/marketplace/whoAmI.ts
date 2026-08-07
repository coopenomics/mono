import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'marketplaceWhoAmI'

export const query = Selector('Query')({
  [name]: {
    username: true,
    core_roles: true,
    marketplace_roles: true,
    branches: true,
    warehouse_settings: {
      containers_enabled: true,
      cells_enabled: true,
      posting_on_reception_required: true,
    },
  },
})

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
