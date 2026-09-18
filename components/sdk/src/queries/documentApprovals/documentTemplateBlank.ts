import { rawDocumentTemplateBlankSelector } from '../../selectors/documentApprovals'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'documentTemplateBlank'

/** Бланк документа: утверждённая советом редакция или текущая редакция сети. */
export const query = Selector('Query')({
  [name]: [
    {
      coopname: $('coopname', 'String!'),
      registry_id: $('registry_id', 'Int!'),
      edition: $('edition', 'DocumentTemplateEdition!'),
      doc_data_hash: $('doc_data_hash', 'String'),
    },
    rawDocumentTemplateBlankSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  coopname: string
  registry_id: number
  edition: ModelTypes['DocumentTemplateEdition']
  /** Хэш приватных параметров документа, если шаблон их требует. */
  doc_data_hash?: string | null
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
