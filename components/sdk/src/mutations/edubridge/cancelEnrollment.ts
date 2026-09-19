import { eduEnrollmentSelector } from '../../selectors/edubridge/memberSelector'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'edubridgeCancelEnrollment'

export const mutation = Selector('Mutation')({
  [name]: [{ enrollment_id: $('enrollment_id', 'ID!') }, eduEnrollmentSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  enrollment_id: string
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
