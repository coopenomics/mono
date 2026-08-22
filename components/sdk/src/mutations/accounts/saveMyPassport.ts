import { accountSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'saveMyPassport'

/**
 * Сохранить собственные паспортные данные в реестре пайщиков.
 * Применяется, когда паспорт ранее не был указан (например, при подписании
 * договора материальной ответственности председателем участка или доверенным
 * лицом). Существующие паспортные данные не перезаписываются.
 */
export const mutation = Selector('Mutation')({
  [name]: [{ passport: $('passport', 'PassportInput!') }, accountSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  passport: ModelTypes['PassportInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
