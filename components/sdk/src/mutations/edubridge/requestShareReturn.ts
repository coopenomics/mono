import { eduTeacherSettlementSelector } from '../../selectors/edubridge/teacherSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'edubridgeRequestShareReturn'

/** Получить возврат паевого взноса: перевод в Цифровой Кошелёк и заявка на возврат по двум подписанным заявлениям */
export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'EduRequestShareReturnInput!') }, eduTeacherSettlementSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['EduRequestShareReturnInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
