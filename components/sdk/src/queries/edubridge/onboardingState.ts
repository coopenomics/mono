import { eduOnboardingStateSelector } from '../../selectors/edubridge/onboardingSelector'
import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'edubridgeOnboardingState'

export const query = Selector('Query')({
  [name]: eduOnboardingStateSelector,
})

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
