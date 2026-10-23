import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'appsPublishers'

/** Назначения издателей «аккаунт → пакет» (487-27). Только chairman. */
export const query = Selector('Query')({
  [name]: { username: true, packageId: true, addedBy: true, createdAt: true },
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
