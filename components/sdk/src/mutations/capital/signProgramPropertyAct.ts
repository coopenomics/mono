import { rawTransactionSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'capitalSignProgramPropertyAct'

/**
 * Пайщик подписывает акт приёма-передачи имущества — первая подпись
 */
export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'SignProgramPropertyActInput!') }, rawTransactionSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['SignProgramPropertyActInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
