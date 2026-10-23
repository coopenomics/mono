import { rawDocumentTemplateSelector } from '../../selectors/documentApprovals'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'documentTemplates'

/** Реестр шаблонов документов кооператива с утверждёнными и доступными редакциями. */
export const query = Selector('Query')({
  [name]: [
    { coopname: $('coopname', 'String!') },
    rawDocumentTemplateSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  coopname: string
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
