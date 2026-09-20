import { documentSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'generateProgramAgreementsAnnulment'

/**
 * Заявление об аннулировании соглашений ЦПП — одно на все программы пайщика.
 * Подписывается вместе с заявлением о выходе из кооператива.
 */
export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'ProgramAgreementsAnnulmentGenerateDocumentInput!'), options: $('options', 'GenerateDocumentOptionsInput') }, documentSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['ProgramAgreementsAnnulmentGenerateDocumentInput']
  options?: ModelTypes['GenerateDocumentOptionsInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
