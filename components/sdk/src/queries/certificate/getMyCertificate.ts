import { participantCertificateSelector } from '../../selectors/certificate/participantCertificateSelector'
import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'getMyCertificate'

/**
 * Получить удостоверение текущего пайщика (participant_certificate, CoopID).
 */
export const query = Selector('Query')({
  [name]: participantCertificateSelector,
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
