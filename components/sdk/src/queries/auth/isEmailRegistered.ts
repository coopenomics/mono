import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'isEmailRegistered'

/**
 * Зарегистрирован ли в кооперативе пайщик с этой электронной почтой.
 * Открытый запрос: его задаёт шаг ввода почты в регистрации.
 */
export const query = Selector('Query')({
  [name]: [{ data: $('data', 'EmailRegistrationCheckInputDTO!') }, true],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['EmailRegistrationCheckInputDTO']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
