import type { GraphQLTypes, InputType, ModelTypes } from '../../zeus/index'
import { $, Selector } from '../../zeus/index'

export const name = 'getPublicProvision'

/**
 * Текст публичного положения кооператива — политики обработки персональных
 * данных, пользовательского соглашения и других положений, чей текст не
 * зависит от подписанта. Собирается на сервере из шаблона в блокчейне, то есть
 * из редакции, утверждённой советом.
 */
export const query = Selector('Query')({
  [name]: [{ data: $('data', 'GetPublicProvisionInput!') }, { title: true, html: true }],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['GetPublicProvisionInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
