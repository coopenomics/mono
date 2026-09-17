import { candidateIntakeSelector } from '../../selectors/registration/candidateIntakeSelector'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'getCandidateIntake'

/**
 * Программа вступления и ответы заявителя на анкеты расширений.
 * Доступно председателю и членам совета.
 */
export const query = Selector('Query')({
  [name]: [
    {
      username: $('username', 'String!'),
    },
    candidateIntakeSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  username: string
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
