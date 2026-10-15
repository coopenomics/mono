import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'cardcoopTakeEntryProfile'

/**
 * Забрать перенесённую анкету в форму вступления.
 *
 * Ровно один раз: повторное обращение — хоть из истории браузера, хоть перебором —
 * получает отказ, а не персональные данные.
 */
export const mutation = Selector('Mutation')({
  [name]: [
    { data: $('data', 'CardcoopEntryInput!') },
    {
      subjectType: true,
      profile: true,
    },
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['CardcoopEntryInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
