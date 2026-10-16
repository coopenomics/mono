import { organizationLookupSelector } from '../../selectors/registration/organizationLookupSelector'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'lookupOrganization'

/**
 * Сведения об организации из государственного реестра по ИНН; пусто — сведений
 * нет, анкета заполняется вручную.
 */
export const query = Selector('Query')({
  [name]: [
    {
      data: $('data', 'LookupOrganizationInput!'),
    },
    organizationLookupSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: GraphQLTypes['LookupOrganizationInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
