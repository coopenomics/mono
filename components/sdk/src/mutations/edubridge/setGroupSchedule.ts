import { eduGroupSelector } from '../../selectors/edubridge/groupSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'edubridgeSetGroupSchedule'

/** Задать окна расписания группы и срок на отчёт: календарь занятий перестраивается */
export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'EduSetGroupScheduleInput!') }, eduGroupSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['EduSetGroupScheduleInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
