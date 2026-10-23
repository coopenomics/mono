import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'myPublisherPackages'

/** Пакеты, издателем которых назначен текущий аккаунт (487-27). */
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
