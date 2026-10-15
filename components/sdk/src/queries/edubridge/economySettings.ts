import { eduEconomySettingsSelector } from '../../selectors/edubridge/economySelector'
import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'edubridgeEconomySettings'

export const query = Selector('Query')({
  [name]: eduEconomySettingsSelector,
})

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
