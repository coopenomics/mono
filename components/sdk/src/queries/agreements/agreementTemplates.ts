import { rawAgreementTemplateSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'agreementTemplates'

export const query = Selector('Query')({
  [name]: [
    { coopname: $('coopname', 'String!') },
    rawAgreementTemplateSelector,
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
