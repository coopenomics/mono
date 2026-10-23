import { eduEnrollmentSelector } from '../../selectors/edubridge/memberSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'edubridgeRetryEnrollmentClose'

/** Повторить закрытие подписки, которая не закрылась при выходе пайщика из кооператива */
export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'EduRetryEnrollmentCloseInput!') }, eduEnrollmentSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['EduRetryEnrollmentCloseInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
