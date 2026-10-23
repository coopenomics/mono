import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'getOrganizationLookupCountries'

/**
 * Страны, для которых анкета организации заполняется сведениями из реестра по ИНН.
 */
export const query = Selector('Query')({
  [name]: true,
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
