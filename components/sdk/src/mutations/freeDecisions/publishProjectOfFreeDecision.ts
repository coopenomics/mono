import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'
import { rawAgendaSelector } from '../../selectors/agenda/agendaSelector'

export const name = 'publishProjectOfFreeDecision'

/**
 * Публикует предложенную повестку и проект решения. Возвращает созданный пункт
 * повестки (или null, если он ещё не проиндексирован) — для немедленного
 * отображения на фронте без ожидания поллинга.
 */
export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'PublishProjectFreeDecisionInput!') }, rawAgendaSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['PublishProjectFreeDecisionInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
