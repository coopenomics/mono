import { extensionOnboardingStateSelector } from '../../selectors/onboarding'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus'

export const name = 'getExtensionOnboardingState'

export const query = Selector('Query')({
  [name]: [
    { extension_name: $('extension_name', 'String!') },
    extensionOnboardingStateSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  extension_name: string
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
