import { eduGroupSelector } from '../../selectors/edubridge/groupSelector'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'edubridgeFinishGroup'

/** Завершить группу: расчёты по подпискам с вышедшим оплаченным сроком закрываются, резерв за занятия без отчёта уходит на кошелёк программы */
export const mutation = Selector('Mutation')({
  [name]: [{ group_id: $('group_id', 'ID!') }, eduGroupSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  group_id: string
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
