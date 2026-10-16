import { entrepreneurLookupSelector } from '../../selectors/registration/entrepreneurLookupSelector'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'lookupEntrepreneur'

/**
 * Сведения об ИП из государственного реестра по ИНН; пусто — сведений нет,
 * анкета заполняется вручную.
 */
export const query = Selector('Query')({
  [name]: [
    {
      data: $('data', 'LookupOrganizationInput!'),
    },
    entrepreneurLookupSelector,
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
