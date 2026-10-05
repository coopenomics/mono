import { documentSelector } from '../../selectors/common/documentSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'edubridgeGuaranteeStatement'

/** Сформировать заявление об аннулировании подписки по гарантийным условиям */
export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'EduGuaranteeStatementInput!') }, documentSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['EduGuaranteeStatementInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
