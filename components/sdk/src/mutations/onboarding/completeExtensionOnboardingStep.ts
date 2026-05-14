import { extensionOnboardingStateSelector } from '../../selectors/onboarding'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus'

export const name = 'completeExtensionOnboardingStep'

export const mutation = Selector('Mutation')({
  [name]: [
    { data: $('data', 'CompleteExtensionOnboardingStepInput!') },
    extensionOnboardingStateSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['CompleteExtensionOnboardingStepInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
