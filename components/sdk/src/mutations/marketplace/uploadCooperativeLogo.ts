import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'marketplaceUploadCooperativeLogo'

/** Администратор меняет логотип кооператива — файл хранится ядром в настройках узла. */
export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'MarketplaceUploadCooperativeLogoInput!') }, true],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['MarketplaceUploadCooperativeLogoInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
