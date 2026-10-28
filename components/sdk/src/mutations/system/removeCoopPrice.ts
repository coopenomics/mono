import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'removeCoopPrice'

/** Снять индивидуальную цену услуги: кооператив на общих основаниях. */
export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'RemoveCoopPriceInput!') }, true],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['RemoveCoopPriceInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
