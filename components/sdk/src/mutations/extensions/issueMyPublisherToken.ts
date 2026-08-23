import { publisherTokenSelector } from '../../selectors/extensions/publisherTokenSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'issueMyPublisherToken'

/** Выпустить ключ каталога на свой пакет (487-27). `token` приходит один раз. */
export const mutation = Selector('Mutation')({
  [name]: [
    { data: $('data', 'IssueMyPublisherTokenInputDTO!') },
    { status: true, token: true, error: true, record: publisherTokenSelector },
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['IssueMyPublisherTokenInputDTO']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
