import { eduAdminSelector } from '../../selectors/edubridge/adminSelector'
import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'edubridgeAdmins'

export const query = Selector('Query')({
  [name]: eduAdminSelector,
})

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
