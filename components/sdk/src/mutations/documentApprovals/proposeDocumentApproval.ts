import { rawDocumentTemplateSelector } from '../../selectors/documentApprovals'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'proposeDocumentApproval'

/** Вынести редакцию документа или пакет документов на утверждение совета. */
export const mutation = Selector('Mutation')({
  [name]: [
    { data: $('data', 'ProposeDocumentApprovalInput!') },
    rawDocumentTemplateSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['ProposeDocumentApprovalInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
