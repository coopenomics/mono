import { rawContentRevisionSummarySelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'capitalGetContentRevisions'

/**
 * Список редакций содержимого проекта/компонента, задачи или артефакта (новые сверху, без тел)
 */
export const query = Selector('Query')({
  [name]: [{ data: $('data', 'CapitalGetContentRevisionsInput!') }, rawContentRevisionSummarySelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['CapitalGetContentRevisionsInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
