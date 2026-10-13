import { eduContributionBriefSelector } from '../../selectors/edubridge/teacherSelector'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'edubridgeContributionBrief'

/** Сведения о взносе результатом работы для вопроса совета: курс, группа, занятие, материалы и сумма */
export const query = Selector('Query')({
  [name]: [{ rid_hash: $('rid_hash', 'String!') }, eduContributionBriefSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  rid_hash: string
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
