import { eduOnboardingStateSelector } from '../../selectors/edubridge/onboardingSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'edubridgeSignOffer'

export const mutation = Selector('Mutation')({
  [name]: [{ input: $('input', 'EduSignOfferInput!') }, eduOnboardingStateSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  input: ModelTypes['EduSignOfferInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
