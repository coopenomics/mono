import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

/** Проверка реквизитов контрагента до сохранения — нарушения по полям. */
export const name = 'checkExpenseCounterpartyRequisites'

export const query = Selector('Query')({
  [name]: [{ data: $('data', 'CheckExpenseCounterpartyInput!') }, { key: true, code: true }],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['CheckExpenseCounterpartyInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
